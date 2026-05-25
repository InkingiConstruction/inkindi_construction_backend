import { ProjectStatus } from "@prisma/client";
import cloudinary from "../../../lib/cloudinary.js";
import prisma from "../../../lib/prisma.js";
const uploadImage = (file, folder) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
        folder,
        resource_type: "image",
    }, (error, result) => {
        if (error || !result) {
            reject(error);
            return;
        }
        resolve(result);
    });
    stream.end(file.buffer);
});
const parseJsonField = (value) => {
    if (!value)
        return undefined;
    if (typeof value !== "string")
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
};
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const isProjectMediaCollection = (value) => value === "sitePhotos" || value === "architecturalPlans";
const getProjectMediaFolder = (collection) => collection === "architecturalPlans"
    ? "inkingi/projects/architectural-plans"
    : "inkingi/projects/site-photos";
const getProjectMediaItems = (value) => {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => {
        return (item !== null &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            "cloudinaryUrl" in item &&
            "publicId" in item &&
            typeof item.cloudinaryUrl === "string" &&
            typeof item.publicId === "string");
    });
};
const getProjectFiles = (files) => {
    const sitePhotoFiles = files.filter((file) => file.fieldname !== "architecturalPlans");
    const architecturalPlanFiles = files.filter((file) => file.fieldname === "architecturalPlans");
    return { sitePhotoFiles, architecturalPlanFiles };
};
const uploadProjectFiles = async (files) => {
    const { sitePhotoFiles, architecturalPlanFiles } = getProjectFiles(files);
    const [sitePhotoUploads, architecturalPlanUploads] = await Promise.all([
        Promise.all(sitePhotoFiles.map((file) => uploadImage(file, "inkingi/projects/site-photos"))),
        Promise.all(architecturalPlanFiles.map((file) => uploadImage(file, "inkingi/projects/architectural-plans"))),
    ]);
    const sitePhotos = sitePhotoUploads.map((photo) => ({
        cloudinaryUrl: photo.secure_url,
        publicId: photo.public_id,
    }));
    const architecturalPlans = architecturalPlanUploads.map((plan) => ({
        cloudinaryUrl: plan.secure_url,
        publicId: plan.public_id,
    }));
    return { sitePhotos, architecturalPlans };
};
const getMediaPublicIds = (value) => {
    return getProjectMediaItems(value).map((item) => item.publicId);
};
const deleteCloudinaryFiles = async (publicIds) => {
    if (publicIds.length === 0)
        return;
    await Promise.allSettled(publicIds.map((publicId) => cloudinary.uploader.destroy(publicId)));
};
const canReadProject = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId));
};
const canUpdateProject = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (role === "client")
        return project.clientId === userId;
    if (role === "engineer")
        return project.engineerId === userId;
    return false;
};
const buildProjectUpdateData = (body) => {
    const data = {};
    if (body.name !== undefined)
        data.name = String(body.name);
    if (body.description !== undefined)
        data.description = String(body.description);
    if (body.status !== undefined)
        data.status = body.status;
    if (body.budget !== undefined)
        data.budget = String(body.budget);
    if (body.currency !== undefined)
        data.currency = String(body.currency);
    if (body.address !== undefined)
        data.address = String(body.address);
    if (body.gpsBoundary !== undefined)
        data.gpsBoundary = parseJsonField(body.gpsBoundary);
    if (body.startDate !== undefined)
        data.startDate = new Date(String(body.startDate));
    if (body.endDate !== undefined)
        data.endDate = new Date(String(body.endDate));
    if (body.engineerId !== undefined) {
        data.engineer = body.engineerId
            ? { connect: { id: String(body.engineerId) } }
            : { disconnect: true };
    }
    return data;
};
const getNextProjectStatus = (status) => {
    const statuses = Object.values(ProjectStatus);
    const currentIndex = statuses.indexOf(status);
    const nextIndex = currentIndex === statuses.length - 1 ? 0 : currentIndex + 1;
    return statuses[nextIndex];
};
export const createProject = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, status, budget, currency, address, gpsBoundary, architecturalPlans, startDate, endDate, engineerId, } = req.body;
        if (!name || !budget) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        const files = req.files || [];
        const uploaded = await uploadProjectFiles(files);
        const bodyArchitecturalPlans = parseJsonField(architecturalPlans);
        const project = await prisma.project.create({
            data: {
                name,
                description,
                status,
                budget,
                currency,
                address,
                gpsBoundary: parseJsonField(gpsBoundary),
                sitePhotos: uploaded.sitePhotos,
                architecturalPlans: uploaded.architecturalPlans.length > 0
                    ? uploaded.architecturalPlans
                    : bodyArchitecturalPlans || [],
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                clientId: userId,
                engineerId: engineerId || undefined,
            },
        });
        return res.status(201).json({
            message: "Project created successfully",
            project,
        });
    }
    catch (error) {
        console.error("Create project error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getProjects = async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.id;
        let projects;
        if (role === "client") {
            projects = await prisma.project.findMany({
                where: { clientId: userId },
            });
        }
        else if (role === "engineer") {
            projects = await prisma.project.findMany({
                where: {
                    OR: [
                        { engineerId: userId },
                        { projectMembers: { some: { userId } } },
                    ],
                },
            });
        }
        else if (role === "supervisor" || role === "supplier") {
            projects = await prisma.project.findMany({
                where: { projectMembers: { some: { userId } } },
            });
        }
        else {
            projects = await prisma.project.findMany();
        }
        return res.json(projects);
    }
    catch (error) {
        console.error("Get projects error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getProjectById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Project ID is required" });
        }
        const project = await prisma.project.findUnique({
            where: { id: id },
            include: {
                client: true,
                engineer: true,
                projectMembers: true,
                milestones: true,
                escrowAccount: true,
            },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canReadProject(project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(project);
    }
    catch (error) {
        console.error("Get project by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const updateProject = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Project ID is required" });
        }
        const existingProject = await prisma.project.findUnique({
            where: { id },
        });
        if (!existingProject) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canUpdateProject(existingProject, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const files = req.files || [];
        const uploaded = await uploadProjectFiles(files);
        const data = buildProjectUpdateData(req.body);
        const bodySitePhotos = parseJsonField(req.body.sitePhotos);
        const bodyArchitecturalPlans = parseJsonField(req.body.architecturalPlans);
        if (uploaded.sitePhotos.length > 0) {
            data.sitePhotos = [
                ...(Array.isArray(existingProject.sitePhotos)
                    ? existingProject.sitePhotos
                    : []),
                ...uploaded.sitePhotos,
            ];
        }
        else if (bodySitePhotos !== undefined) {
            data.sitePhotos = bodySitePhotos;
        }
        if (uploaded.architecturalPlans.length > 0) {
            data.architecturalPlans = [
                ...(Array.isArray(existingProject.architecturalPlans)
                    ? existingProject.architecturalPlans
                    : []),
                ...uploaded.architecturalPlans,
            ];
        }
        else if (bodyArchitecturalPlans !== undefined) {
            data.architecturalPlans = bodyArchitecturalPlans;
        }
        const project = await prisma.project.update({
            where: { id },
            data,
        });
        return res.json({
            message: "Project updated successfully",
            project,
        });
    }
    catch (error) {
        console.error("Update project error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const toggleProjectStatus = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const requestedStatus = req.body.status;
        if (!id) {
            return res.status(400).json({ message: "Project ID is required" });
        }
        const existingProject = await prisma.project.findUnique({
            where: { id },
        });
        if (!existingProject) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canUpdateProject(existingProject, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (requestedStatus &&
            !Object.values(ProjectStatus).includes(requestedStatus)) {
            return res.status(400).json({ message: "Invalid project status" });
        }
        const status = requestedStatus
            ? requestedStatus
            : getNextProjectStatus(existingProject.status);
        const project = await prisma.project.update({
            where: { id },
            data: { status },
        });
        return res.json({
            message: "Project status updated successfully",
            project,
        });
    }
    catch (error) {
        console.error("Toggle project status error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const changeProjectImage = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { collection, publicId } = req.body;
        const files = req.files || [];
        const file = files[0];
        if (!id) {
            return res.status(400).json({ message: "Project ID is required" });
        }
        if (!isProjectMediaCollection(collection)) {
            return res.status(400).json({ message: "Invalid image collection" });
        }
        if (!publicId) {
            return res.status(400).json({ message: "Image publicId is required" });
        }
        if (!file) {
            return res.status(400).json({ message: "New image file is required" });
        }
        const existingProject = await prisma.project.findUnique({
            where: { id },
        });
        if (!existingProject) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canUpdateProject(existingProject, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const media = getProjectMediaItems(existingProject[collection]);
        const imageIndex = media.findIndex((item) => item.publicId === publicId);
        if (imageIndex === -1) {
            return res.status(404).json({ message: "Project image not found" });
        }
        const uploadedImage = await uploadImage(file, getProjectMediaFolder(collection));
        const oldPublicId = media[imageIndex].publicId;
        media[imageIndex] = {
            cloudinaryUrl: uploadedImage.secure_url,
            publicId: uploadedImage.public_id,
        };
        const project = await prisma.project.update({
            where: { id },
            data: collection === "sitePhotos"
                ? { sitePhotos: media }
                : { architecturalPlans: media },
        });
        await deleteCloudinaryFiles([oldPublicId]);
        return res.json({
            message: "Project image changed successfully",
            project,
        });
    }
    catch (error) {
        console.error("Change project image error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const deleteProjectImage = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { collection, publicId } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Project ID is required" });
        }
        if (!isProjectMediaCollection(collection)) {
            return res.status(400).json({ message: "Invalid image collection" });
        }
        if (!publicId) {
            return res.status(400).json({ message: "Image publicId is required" });
        }
        const existingProject = await prisma.project.findUnique({
            where: { id },
        });
        if (!existingProject) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canUpdateProject(existingProject, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const media = getProjectMediaItems(existingProject[collection]);
        const imageExists = media.some((item) => item.publicId === publicId);
        if (!imageExists) {
            return res.status(404).json({ message: "Project image not found" });
        }
        const updatedMedia = media.filter((item) => item.publicId !== publicId);
        const project = await prisma.project.update({
            where: { id },
            data: collection === "sitePhotos"
                ? { sitePhotos: updatedMedia }
                : { architecturalPlans: updatedMedia },
        });
        await deleteCloudinaryFiles([String(publicId)]);
        return res.json({
            message: "Project image deleted successfully",
            project,
        });
    }
    catch (error) {
        console.error("Delete project image error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const deleteProject = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Project ID is required" });
        }
        const project = await prisma.project.findUnique({
            where: { id },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (req.user.role !== "admin" && project.clientId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const publicIds = [
            ...getMediaPublicIds(project.sitePhotos),
            ...getMediaPublicIds(project.architecturalPlans),
        ];
        await prisma.project.delete({
            where: { id },
        });
        await deleteCloudinaryFiles(publicIds);
        return res.json({ message: "Project deleted successfully" });
    }
    catch (error) {
        console.error("Delete project error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

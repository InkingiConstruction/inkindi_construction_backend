"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProgressPhoto = exports.updateProgressPhoto = exports.getProgressPhotoById = exports.getProgressPhotos = exports.createProgressPhoto = void 0;
const client_1 = require("@prisma/client");
const cloudinary_js_1 = __importDefault(require("../../../config/cloudinary.js"));
const db_js_1 = __importDefault(require("../../../config/db.js"));
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const uploadMedia = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary_js_1.default.uploader.upload_stream({
        folder: "inkingi/projects/progress",
        resource_type: file.mimetype.startsWith("video/") ? "video" : "image",
    }, (error, result) => {
        if (error || !result) {
            reject(error);
            return;
        }
        resolve(result);
    });
    stream.end(file.buffer);
});
const deleteCloudinaryFile = async (publicId, isVideo) => {
    await cloudinary_js_1.default.uploader.destroy(publicId, {
        resource_type: isVideo ? "video" : "image",
    });
};
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
const isProgressReviewStatus = (value) => typeof value === "string" &&
    Object.values(client_1.ProgressReviewStatus).includes(value);
const isAcceptedSupervisor = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (role !== "supervisor")
        return false;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId &&
        member.role === "supervisor" &&
        member.status === "accepted"));
};
const canReadProject = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const canUploadProgress = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (role === "engineer")
        return project.engineerId === userId;
    if (role === "supervisor") {
        return Boolean(project.projectMembers?.some((member) => member.userId === userId &&
            member.role === "supervisor" &&
            member.status === "accepted"));
    }
    return false;
};
const canManageProgressPhoto = (photo, userId, role) => {
    if (role === "admin")
        return true;
    if (photo.uploadedById === userId)
        return true;
    return canUploadProgress(photo.project, userId, role);
};
const createProgressPhoto = async (req, res) => {
    try {
        const { projectId, milestoneId, gpsLocation, caption, videoDuration } = req.body;
        const files = req.files || [];
        if (!projectId) {
            return res.status(400).json({ message: "projectId is required" });
        }
        if (files.length === 0) {
            return res.status(400).json({ message: "At least one file is required" });
        }
        const project = await db_js_1.default.project.findUnique({
            where: { id: String(projectId) },
            include: {
                projectMembers: true,
            },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canUploadProgress(project, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the project engineer, assigned supervisor, or admin can upload progress media",
            });
        }
        if (milestoneId) {
            const milestone = await db_js_1.default.milestone.findFirst({
                where: {
                    id: String(milestoneId),
                    projectId: project.id,
                },
            });
            if (!milestone) {
                return res.status(400).json({
                    message: "milestoneId must belong to the same project",
                });
            }
        }
        const uploads = await Promise.all(files.map((file) => uploadMedia(file)));
        const progressPhotos = await Promise.all(uploads.map((upload, index) => {
            const file = files[index];
            const isVideo = file.mimetype.startsWith("video/");
            return db_js_1.default.progressPhoto.create({
                data: {
                    projectId: project.id,
                    milestoneId: milestoneId || undefined,
                    uploadedById: req.user.id,
                    cloudinaryUrl: upload.secure_url,
                    publicId: upload.public_id,
                    gpsLocation: parseJsonField(gpsLocation),
                    caption,
                    isVideo,
                    videoDuration: videoDuration !== undefined ? Number(videoDuration) : undefined,
                },
                include: {
                    project: true,
                    milestone: true,
                    uploadedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                            role: true,
                        },
                    },
                },
            });
        }));
        return res.status(201).json({
            message: "Progress media uploaded successfully",
            progressPhotos,
        });
    }
    catch (error) {
        console.error("Create progress photo error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createProgressPhoto = createProgressPhoto;
const getProgressPhotos = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const milestoneId = typeof req.query.milestoneId === "string"
            ? req.query.milestoneId
            : undefined;
        const progressPhotos = await db_js_1.default.progressPhoto.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(milestoneId ? { milestoneId } : {}),
                ...(req.user.role === "client"
                    ? { reviewStatus: { in: ["approved", "rejected"] } }
                    : {}),
                ...(req.user.role === "admin"
                    ? {}
                    : {
                        project: {
                            OR: [
                                { clientId: req.user.id },
                                { engineerId: req.user.id },
                                {
                                    projectMembers: {
                                        some: {
                                            userId: req.user.id,
                                            status: "accepted",
                                        },
                                    },
                                },
                            ],
                        },
                    }),
            },
            include: {
                project: true,
                milestone: true,
                uploadedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.json(progressPhotos);
    }
    catch (error) {
        console.error("Get progress photos error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getProgressPhotos = getProgressPhotos;
const getProgressPhotoById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Progress photo ID is required" });
        }
        const progressPhoto = await db_js_1.default.progressPhoto.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        projectMembers: true,
                    },
                },
                milestone: true,
                uploadedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
            },
        });
        if (!progressPhoto) {
            return res.status(404).json({ message: "Progress photo not found" });
        }
        if (!canReadProject(progressPhoto.project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(progressPhoto);
    }
    catch (error) {
        console.error("Get progress photo by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getProgressPhotoById = getProgressPhotoById;
const updateProgressPhoto = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { milestoneId, gpsLocation, caption, videoDuration, reviewStatus, supervisorComment } = req.body;
        const files = req.files || [];
        const file = files[0];
        if (!id) {
            return res.status(400).json({ message: "Progress photo ID is required" });
        }
        const existingPhoto = await db_js_1.default.progressPhoto.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        projectMembers: true,
                    },
                },
            },
        });
        if (!existingPhoto) {
            return res.status(404).json({ message: "Progress photo not found" });
        }
        const reviewingProgress = reviewStatus !== undefined || supervisorComment !== undefined;
        if (reviewingProgress && !isAcceptedSupervisor(existingPhoto.project, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the assigned supervisor or admin can review progress media",
            });
        }
        if (!reviewingProgress && !canManageProgressPhoto(existingPhoto, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the uploader, project engineer, assigned supervisor, or admin can update this media",
            });
        }
        if (reviewStatus !== undefined && !isProgressReviewStatus(reviewStatus)) {
            return res.status(400).json({ message: "Invalid progress review status" });
        }
        if (milestoneId) {
            const milestone = await db_js_1.default.milestone.findFirst({
                where: {
                    id: String(milestoneId),
                    projectId: existingPhoto.projectId,
                },
            });
            if (!milestone) {
                return res.status(400).json({
                    message: "milestoneId must belong to the same project",
                });
            }
        }
        const data = {};
        let oldPublicId = null;
        let oldWasVideo = false;
        if (milestoneId !== undefined) {
            data.milestone = milestoneId
                ? { connect: { id: String(milestoneId) } }
                : { disconnect: true };
        }
        if (gpsLocation !== undefined)
            data.gpsLocation = parseJsonField(gpsLocation);
        if (caption !== undefined)
            data.caption = caption ? String(caption) : null;
        if (videoDuration !== undefined) {
            data.videoDuration = videoDuration ? Number(videoDuration) : null;
        }
        if (reviewStatus !== undefined) {
            data.reviewStatus = reviewStatus;
            data.reviewedById = req.user.id;
            data.reviewedAt = new Date();
        }
        if (supervisorComment !== undefined) {
            data.supervisorComment = supervisorComment ? String(supervisorComment) : null;
        }
        if (file) {
            const uploaded = await uploadMedia(file);
            oldPublicId = existingPhoto.publicId;
            oldWasVideo = existingPhoto.isVideo;
            data.cloudinaryUrl = uploaded.secure_url;
            data.publicId = uploaded.public_id;
            data.isVideo = file.mimetype.startsWith("video/");
            data.reviewStatus = "pending";
            data.supervisorComment = null;
            data.reviewedById = null;
            data.reviewedAt = null;
        }
        const progressPhoto = await db_js_1.default.progressPhoto.update({
            where: { id },
            data,
            include: {
                project: true,
                milestone: true,
                uploadedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
            },
        });
        if (oldPublicId) {
            await deleteCloudinaryFile(oldPublicId, oldWasVideo);
        }
        return res.json({
            message: "Progress media updated successfully",
            progressPhoto,
        });
    }
    catch (error) {
        console.error("Update progress photo error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateProgressPhoto = updateProgressPhoto;
const deleteProgressPhoto = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Progress photo ID is required" });
        }
        const progressPhoto = await db_js_1.default.progressPhoto.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        projectMembers: true,
                    },
                },
            },
        });
        if (!progressPhoto) {
            return res.status(404).json({ message: "Progress photo not found" });
        }
        if (!canManageProgressPhoto(progressPhoto, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the uploader, project engineer, assigned supervisor, or admin can delete this media",
            });
        }
        await db_js_1.default.progressPhoto.delete({
            where: { id },
        });
        await deleteCloudinaryFile(progressPhoto.publicId, progressPhoto.isVideo);
        return res.json({ message: "Progress media deleted successfully" });
    }
    catch (error) {
        console.error("Delete progress photo error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteProgressPhoto = deleteProgressPhoto;

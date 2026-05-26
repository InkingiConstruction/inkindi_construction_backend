"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDisputeEvidence = exports.updateDisputeEvidence = exports.getDisputeEvidenceById = exports.getDisputeEvidences = exports.createDisputeEvidence = void 0;
const cloudinary_js_1 = __importDefault(require("../../../lib/cloudinary.js"));
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getId = (id) => Array.isArray(id) ? id[0] : id;
const uploadImage = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary_js_1.default.uploader.upload_stream({
        folder: "inkingi/disputes/evidence",
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
const canReadProject = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const createDisputeEvidence = async (req, res) => {
    try {
        const { disputeId, description } = req.body;
        const files = req.files || [];
        if (!disputeId) {
            return res.status(400).json({ message: "disputeId is required" });
        }
        if (files.length === 0) {
            return res.status(400).json({ message: "At least one file is required" });
        }
        const dispute = await prisma_js_1.default.dispute.findUnique({
            where: { id: String(disputeId) },
            include: { project: { include: { projectMembers: true } } },
        });
        if (!dispute) {
            return res.status(404).json({ message: "Dispute not found" });
        }
        if (!canReadProject(dispute.project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const uploads = await Promise.all(files.map(uploadImage));
        const evidence = await Promise.all(uploads.map((upload) => prisma_js_1.default.disputeEvidence.create({
            data: {
                disputeId: dispute.id,
                uploadedById: req.user.id,
                cloudinaryUrl: upload.secure_url,
                description,
            },
            include: {
                uploadedBy: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        })));
        return res.status(201).json({
            message: "Dispute evidence uploaded successfully",
            evidence,
        });
    }
    catch (error) {
        console.error("Create dispute evidence error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createDisputeEvidence = createDisputeEvidence;
const getDisputeEvidences = async (req, res) => {
    try {
        const disputeId = typeof req.query.disputeId === "string"
            ? req.query.disputeId
            : undefined;
        const evidences = await prisma_js_1.default.disputeEvidence.findMany({
            where: {
                ...(disputeId ? { disputeId } : {}),
                ...(req.user.role === "admin"
                    ? {}
                    : {
                        dispute: {
                            project: {
                                OR: [
                                    { clientId: req.user.id },
                                    { engineerId: req.user.id },
                                    {
                                        projectMembers: {
                                            some: { userId: req.user.id, status: "accepted" },
                                        },
                                    },
                                ],
                            },
                        },
                    }),
            },
            include: {
                dispute: true,
                uploadedBy: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(evidences);
    }
    catch (error) {
        console.error("Get dispute evidences error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getDisputeEvidences = getDisputeEvidences;
const getDisputeEvidenceById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Evidence ID is required" });
        }
        const evidence = await prisma_js_1.default.disputeEvidence.findUnique({
            where: { id },
            include: {
                dispute: { include: { project: { include: { projectMembers: true } } } },
                uploadedBy: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
        if (!evidence) {
            return res.status(404).json({ message: "Evidence not found" });
        }
        if (!canReadProject(evidence.dispute.project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(evidence);
    }
    catch (error) {
        console.error("Get dispute evidence by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getDisputeEvidenceById = getDisputeEvidenceById;
const updateDisputeEvidence = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { description } = req.body;
        const files = req.files || [];
        if (!id) {
            return res.status(400).json({ message: "Evidence ID is required" });
        }
        const existing = await prisma_js_1.default.disputeEvidence.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Evidence not found" });
        }
        if (req.user.role !== "admin" && existing.uploadedById !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const upload = files[0] ? await uploadImage(files[0]) : null;
        const evidence = await prisma_js_1.default.disputeEvidence.update({
            where: { id },
            data: {
                description,
                cloudinaryUrl: upload?.secure_url,
            },
            include: {
                dispute: true,
                uploadedBy: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
        return res.json({
            message: "Dispute evidence updated successfully",
            evidence,
        });
    }
    catch (error) {
        console.error("Update dispute evidence error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateDisputeEvidence = updateDisputeEvidence;
const deleteDisputeEvidence = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Evidence ID is required" });
        }
        const evidence = await prisma_js_1.default.disputeEvidence.findUnique({
            where: { id },
        });
        if (!evidence) {
            return res.status(404).json({ message: "Evidence not found" });
        }
        if (req.user.role !== "admin" && evidence.uploadedById !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await prisma_js_1.default.disputeEvidence.delete({ where: { id } });
        return res.json({ message: "Dispute evidence deleted successfully" });
    }
    catch (error) {
        console.error("Delete dispute evidence error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteDisputeEvidence = deleteDisputeEvidence;

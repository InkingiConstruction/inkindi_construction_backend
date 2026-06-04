"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDispute = exports.updateDispute = exports.getDisputeById = exports.getDisputes = exports.createDispute = void 0;
const client_1 = require("@prisma/client");
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const notifications_js_1 = require("../../../lib/notifications.js");
const getId = (id) => Array.isArray(id) ? id[0] : id;
const parseJson = (value) => {
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
const isCategory = (value) => typeof value === "string" &&
    Object.values(client_1.DisputeCategory).includes(value);
const isStatus = (value) => typeof value === "string" &&
    Object.values(client_1.DisputeStatus).includes(value);
const canReadProject = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const createDispute = async (req, res) => {
    try {
        const { projectId, milestoneId, category, description, amountInDispute } = req.body;
        if (!projectId || !category || !description || !amountInDispute) {
            return res.status(400).json({
                message: "projectId, category, description and amountInDispute are required",
            });
        }
        if (!isCategory(category)) {
            return res.status(400).json({ message: "Invalid dispute category" });
        }
        const project = await prisma_js_1.default.project.findUnique({
            where: { id: String(projectId) },
            include: { projectMembers: true },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canReadProject(project, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "You do not have access to this project",
            });
        }
        if (milestoneId) {
            const milestone = await prisma_js_1.default.milestone.findFirst({
                where: { id: String(milestoneId), projectId: project.id },
            });
            if (!milestone) {
                return res.status(400).json({
                    message: "milestoneId must belong to the selected project",
                });
            }
        }
        const dispute = await prisma_js_1.default.dispute.create({
            data: {
                projectId: project.id,
                milestoneId: milestoneId ? String(milestoneId) : undefined,
                raisedById: req.user.id,
                category,
                description,
                amountInDispute: new client_1.Prisma.Decimal(amountInDispute),
            },
            include: {
                project: true,
                milestone: true,
                raisedBy: {
                    select: { id: true, name: true, email: true, role: true, image: true },
                },
                evidence: true,
            },
        });
        await (0, notifications_js_1.notifyProjectParticipants)({
            projectId: dispute.projectId,
            excludeUserId: req.user.id,
            title: "New dispute raised",
            body: `${dispute.raisedBy.name} raised a ${dispute.category} dispute`,
            data: {
                disputeId: dispute.id,
                milestoneId: dispute.milestoneId,
                type: "dispute_created",
            },
        });
        return res.status(201).json({
            message: "Dispute created successfully",
            dispute,
        });
    }
    catch (error) {
        console.error("Create dispute error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createDispute = createDispute;
const getDisputes = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const milestoneId = typeof req.query.milestoneId === "string"
            ? req.query.milestoneId
            : undefined;
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        if (status !== undefined && !isStatus(status)) {
            return res.status(400).json({ message: "Invalid dispute status" });
        }
        const disputes = await prisma_js_1.default.dispute.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(milestoneId ? { milestoneId } : {}),
                ...(status ? { status } : {}),
                ...(req.user.role === "admin"
                    ? {}
                    : {
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
                    }),
            },
            include: {
                project: true,
                milestone: true,
                raisedBy: {
                    select: { id: true, name: true, email: true, role: true, image: true },
                },
                evidence: true,
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(disputes);
    }
    catch (error) {
        console.error("Get disputes error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getDisputes = getDisputes;
const getDisputeById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Dispute ID is required" });
        }
        const dispute = await prisma_js_1.default.dispute.findUnique({
            where: { id },
            include: {
                project: { include: { projectMembers: true } },
                milestone: true,
                raisedBy: {
                    select: { id: true, name: true, email: true, role: true, image: true },
                },
                evidence: {
                    include: {
                        uploadedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                                image: true,
                            },
                        },
                    },
                },
            },
        });
        if (!dispute) {
            return res.status(404).json({ message: "Dispute not found" });
        }
        if (!canReadProject(dispute.project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(dispute);
    }
    catch (error) {
        console.error("Get dispute by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getDisputeById = getDisputeById;
const updateDispute = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { status, resolution, resolvedBy, description, amountInDispute } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Dispute ID is required" });
        }
        if (status !== undefined && !isStatus(status)) {
            return res.status(400).json({ message: "Invalid dispute status" });
        }
        const dispute = await prisma_js_1.default.dispute.update({
            where: { id },
            data: {
                status,
                resolution: resolution !== undefined ? parseJson(resolution) : undefined,
                resolvedBy: status && status !== "open" && status !== "under_review"
                    ? resolvedBy || req.user.id
                    : resolvedBy,
                resolvedAt: status && status !== "open" && status !== "under_review"
                    ? new Date()
                    : undefined,
                description,
                amountInDispute: amountInDispute !== undefined
                    ? new client_1.Prisma.Decimal(amountInDispute)
                    : undefined,
            },
            include: {
                project: true,
                milestone: true,
                evidence: true,
            },
        });
        if (status) {
            await (0, notifications_js_1.notifyProjectParticipants)({
                projectId: dispute.projectId,
                excludeUserId: req.user.id,
                title: "Dispute updated",
                body: `Dispute status is now ${dispute.status}`,
                data: {
                    disputeId: dispute.id,
                    status: dispute.status,
                    type: "dispute_status_updated",
                },
            });
        }
        return res.json({
            message: "Dispute updated successfully",
            dispute,
        });
    }
    catch (error) {
        console.error("Update dispute error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateDispute = updateDispute;
const deleteDispute = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Dispute ID is required" });
        }
        await prisma_js_1.default.dispute.delete({ where: { id } });
        return res.json({ message: "Dispute deleted successfully" });
    }
    catch (error) {
        console.error("Delete dispute error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteDispute = deleteDispute;

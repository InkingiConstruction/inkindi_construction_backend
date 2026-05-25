"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMilestone = exports.updateMilestone = exports.getMilestoneById = exports.getMilestones = exports.createMilestone = void 0;
const client_1 = require("@prisma/client");
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const canReadProjectMilestones = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const canManageMilestone = (milestone, userId, role) => {
    if (role === "admin")
        return true;
    if (role === "engineer")
        return milestone.engineerId === userId;
    if (role === "supervisor") {
        return Boolean(milestone.project.projectMembers?.some((member) => member.userId === userId &&
            member.role === "supervisor" &&
            member.status === "accepted"));
    }
    return false;
};
const canDeleteMilestone = (milestone, userId, role) => {
    if (role === "admin")
        return true;
    return role === "engineer" && milestone.engineerId === userId;
};
const isMilestoneStatus = (value) => typeof value === "string" &&
    Object.values(client_1.MilestoneStatus).includes(value);
const buildMilestoneUpdateData = (body) => {
    const data = {};
    if (body.name !== undefined)
        data.name = String(body.name);
    if (body.description !== undefined)
        data.description = String(body.description);
    if (body.budgetPercentage !== undefined)
        data.budgetPercentage = String(body.budgetPercentage);
    if (body.durationDays !== undefined)
        data.durationDays = Number(body.durationDays);
    if (body.acceptanceCriteria !== undefined)
        data.acceptanceCriteria = String(body.acceptanceCriteria);
    if (body.dependsOn !== undefined) {
        data.dependsOn = body.dependsOn ? String(body.dependsOn) : null;
    }
    if (body.order !== undefined)
        data.order = Number(body.order);
    if (body.status !== undefined) {
        data.status = body.status;
        if (body.status === "paid")
            data.paidAt = new Date();
        if (body.status === "pending_supervisor")
            data.completedAt = new Date();
    }
    if (body.completedAt !== undefined) {
        data.completedAt = body.completedAt
            ? new Date(String(body.completedAt))
            : null;
    }
    if (body.paidAt !== undefined) {
        data.paidAt = body.paidAt ? new Date(String(body.paidAt)) : null;
    }
    return data;
};
const createMilestone = async (req, res) => {
    try {
        const { projectId, name, description, budgetPercentage, durationDays, acceptanceCriteria, dependsOn, order, status, } = req.body;
        if (!projectId ||
            !name ||
            budgetPercentage === undefined ||
            order === undefined) {
            return res.status(400).json({
                message: "projectId, name, budgetPercentage and order are required",
            });
        }
        if (status !== undefined && !isMilestoneStatus(status)) {
            return res.status(400).json({ message: "Invalid milestone status" });
        }
        const project = await prisma_js_1.default.project.findUnique({
            where: { id: String(projectId) },
            include: {
                milestones: true,
                projectMembers: true,
            },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (req.user.role !== "admin" && project.engineerId !== req.user.id) {
            return res.status(403).json({
                message: "Only the accepted project engineer or admin can create milestones",
            });
        }
        const engineerId = req.user.role === "admin"
            ? project.engineerId || req.user.id
            : req.user.id;
        if (!engineerId) {
            return res.status(400).json({
                message: "Project has no accepted engineer",
            });
        }
        if (dependsOn) {
            const dependency = await prisma_js_1.default.milestone.findFirst({
                where: {
                    id: String(dependsOn),
                    projectId: project.id,
                },
            });
            if (!dependency) {
                return res.status(400).json({
                    message: "dependsOn milestone must belong to the same project",
                });
            }
        }
        const nextTotal = project.milestones.reduce((sum, milestone) => sum + Number(milestone.budgetPercentage), Number(budgetPercentage));
        if (nextTotal > 100) {
            return res.status(400).json({
                message: "Total milestone budget percentage cannot exceed 100",
            });
        }
        const milestone = await prisma_js_1.default.milestone.create({
            data: {
                projectId: project.id,
                engineerId,
                name: String(name),
                description,
                budgetPercentage: String(budgetPercentage),
                durationDays: durationDays !== undefined ? Number(durationDays) : undefined,
                acceptanceCriteria,
                dependsOn: dependsOn || undefined,
                order: Number(order),
                status: status || undefined,
            },
            include: {
                project: true,
                engineer: {
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
        return res.status(201).json({
            message: "Milestone created successfully",
            milestone,
        });
    }
    catch (error) {
        console.error("Create milestone error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createMilestone = createMilestone;
const getMilestones = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        if (status !== undefined && !isMilestoneStatus(status)) {
            return res.status(400).json({ message: "Invalid milestone status" });
        }
        const milestones = await prisma_js_1.default.milestone.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(status ? { status } : {}),
                ...(req.user.role === "admin"
                    ? {}
                    : req.user.role === "client"
                        ? { project: { clientId: req.user.id } }
                        : req.user.role === "engineer"
                            ? {
                                OR: [
                                    { engineerId: req.user.id },
                                    {
                                        project: {
                                            projectMembers: {
                                                some: { userId: req.user.id, status: "accepted" },
                                            },
                                        },
                                    },
                                ],
                            }
                            : {
                                project: {
                                    projectMembers: {
                                        some: {
                                            userId: req.user.id,
                                            status: "accepted",
                                        },
                                    },
                                },
                            }),
            },
            include: {
                project: true,
                engineer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
                _count: {
                    select: {
                        boqItems: true,
                        inspections: true,
                        rfqs: true,
                        progressPhotos: true,
                        disputes: true,
                        transactions: true,
                    },
                },
            },
            orderBy: [{ projectId: "asc" }, { order: "asc" }, { createdAt: "desc" }],
        });
        return res.json(milestones);
    }
    catch (error) {
        console.error("Get milestones error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMilestones = getMilestones;
const getMilestoneById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Milestone ID is required" });
        }
        const milestone = await prisma_js_1.default.milestone.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        projectMembers: true,
                    },
                },
                engineer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
                boqItems: true,
                inspections: true,
                progressPhotos: true,
                rfqs: true,
                transactions: true,
                disputes: true,
            },
        });
        if (!milestone) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        if (!canReadProjectMilestones(milestone.project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(milestone);
    }
    catch (error) {
        console.error("Get milestone by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMilestoneById = getMilestoneById;
const updateMilestone = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Milestone ID is required" });
        }
        if (req.body.status !== undefined && !isMilestoneStatus(req.body.status)) {
            return res.status(400).json({ message: "Invalid milestone status" });
        }
        const existingMilestone = await prisma_js_1.default.milestone.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        milestones: true,
                        projectMembers: true,
                    },
                },
            },
        });
        if (!existingMilestone) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        if (!canManageMilestone(existingMilestone, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the project engineer, assigned supervisor, or admin can update this milestone",
            });
        }
        if (req.body.dependsOn) {
            const dependency = await prisma_js_1.default.milestone.findFirst({
                where: {
                    id: String(req.body.dependsOn),
                    projectId: existingMilestone.projectId,
                    NOT: { id: existingMilestone.id },
                },
            });
            if (!dependency) {
                return res.status(400).json({
                    message: "dependsOn milestone must belong to the same project",
                });
            }
        }
        if (req.body.budgetPercentage !== undefined) {
            const nextTotal = existingMilestone.project.milestones.reduce((sum, milestone) => sum +
                (milestone.id === existingMilestone.id
                    ? Number(req.body.budgetPercentage)
                    : Number(milestone.budgetPercentage)), 0);
            if (nextTotal > 100) {
                return res.status(400).json({
                    message: "Total milestone budget percentage cannot exceed 100",
                });
            }
        }
        const milestone = await prisma_js_1.default.milestone.update({
            where: { id },
            data: buildMilestoneUpdateData(req.body),
            include: {
                project: true,
                engineer: {
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
        return res.json({
            message: "Milestone updated successfully",
            milestone,
        });
    }
    catch (error) {
        console.error("Update milestone error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateMilestone = updateMilestone;
const deleteMilestone = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Milestone ID is required" });
        }
        const milestone = await prisma_js_1.default.milestone.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        inspections: true,
                        rfqs: true,
                        transactions: true,
                        progressPhotos: true,
                        disputes: true,
                    },
                },
            },
        });
        if (!milestone) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        if (!canDeleteMilestone(milestone, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the milestone engineer or admin can delete this milestone",
            });
        }
        const hasDependentRecords = milestone._count.inspections > 0 ||
            milestone._count.rfqs > 0 ||
            milestone._count.transactions > 0 ||
            milestone._count.progressPhotos > 0 ||
            milestone._count.disputes > 0;
        if (hasDependentRecords) {
            return res.status(400).json({
                message: "Milestone has dependent records and cannot be deleted",
            });
        }
        await prisma_js_1.default.milestone.delete({
            where: { id },
        });
        return res.json({ message: "Milestone deleted successfully" });
    }
    catch (error) {
        console.error("Delete milestone error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteMilestone = deleteMilestone;

"use strict";
/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : milestone.service.ts
 * WHAT THIS FILE DOES : Handles all Milestone CRUD, permission checks, and budget validation
 * HOW IT DOES IT      : Queries Prisma ORM with role-based filters and enforces business rules
 * DATA SOURCE         : Controller parameters (milestoneId, projectId, user context)
 * DATA DESTINATION    : Prisma PostgreSQL Database
 * PRINCIPLE APPLIED   : SOLID (Isolated business and data layer)
 * ============================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilestoneService = void 0;
const client_1 = require("@prisma/client");
const db_js_1 = __importDefault(require("../../../config/db.js"));
const canReadMilestones = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((m) => m.userId === userId && m.status === "accepted"));
};
const canManageMilestone = (milestone, userId, role, body) => {
    if (role === "admin")
        return true;
    if (role === "client") {
        const onlyRequestsRevision = milestone.project.clientId === userId &&
            body?.status === "revision_required" &&
            Object.keys(body).every((key) => ["status", "revisionNotes", "clientNotes"].includes(key));
        return onlyRequestsRevision;
    }
    if (role === "engineer")
        return milestone.engineerId === userId;
    if (role === "supervisor") {
        return Boolean(milestone.project.projectMembers?.some((m) => m.userId === userId && m.role === "supervisor" && m.status === "accepted"));
    }
    return false;
};
const isMilestoneStatus = (value) => typeof value === "string" && Object.values(client_1.MilestoneStatus).includes(value);
const buildUpdateData = (body) => {
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
    if (body.dependsOn !== undefined)
        data.dependsOn = body.dependsOn ? String(body.dependsOn) : null;
    if (body.order !== undefined)
        data.order = Number(body.order);
    if (body.status !== undefined) {
        data.status = body.status;
        if (body.status === "paid")
            data.paidAt = new Date();
        if (body.status === "pending_supervisor")
            data.completedAt = new Date();
    }
    if (body.completedAt !== undefined)
        data.completedAt = body.completedAt ? new Date(String(body.completedAt)) : null;
    if (body.paidAt !== undefined)
        data.paidAt = body.paidAt ? new Date(String(body.paidAt)) : null;
    return data;
};
const engineerSelect = { id: true, name: true, email: true, image: true, role: true };
class MilestoneService {
    static async createMilestone(body, userId, userRole) {
        const { projectId, name, description, budgetPercentage, durationDays, acceptanceCriteria, dependsOn, order, status } = body;
        if (!projectId || !name || budgetPercentage === undefined || order === undefined) {
            throw new Error("projectId, name, budgetPercentage and order are required");
        }
        if (status !== undefined && !isMilestoneStatus(status))
            throw new Error("Invalid milestone status");
        const project = await db_js_1.default.project.findUnique({
            where: { id: String(projectId) },
            include: { milestones: true, projectMembers: true },
        });
        if (!project)
            throw new Error("Project not found");
        if (userRole !== "admin" && project.engineerId !== userId)
            throw new Error("ENGINEER_ONLY");
        const engineerId = userRole === "admin" ? project.engineerId || userId : userId;
        if (!engineerId)
            throw new Error("Project has no accepted engineer");
        if (dependsOn) {
            const dep = await db_js_1.default.milestone.findFirst({ where: { id: String(dependsOn), projectId: project.id } });
            if (!dep)
                throw new Error("dependsOn milestone must belong to the same project");
        }
        const nextTotal = project.milestones.reduce((sum, m) => sum + Number(m.budgetPercentage), Number(budgetPercentage));
        if (nextTotal > 100)
            throw new Error("Total milestone budget percentage cannot exceed 100");
        return await db_js_1.default.milestone.create({
            data: {
                projectId: project.id, engineerId: engineerId, name: String(name), description,
                budgetPercentage: String(budgetPercentage),
                durationDays: durationDays !== undefined ? Number(durationDays) : undefined,
                acceptanceCriteria, dependsOn: dependsOn || undefined, order: Number(order), status: status || undefined,
            },
            include: { project: true, engineer: { select: engineerSelect } },
        });
    }
    static async getMilestones(query, userId, userRole) {
        const projectId = typeof query.projectId === "string" ? query.projectId : undefined;
        const status = typeof query.status === "string" ? query.status : undefined;
        if (status !== undefined && !isMilestoneStatus(status))
            throw new Error("Invalid milestone status");
        const roleFilter = userRole === "admin" ? {} :
            userRole === "client" ? { project: { clientId: userId } } :
                userRole === "engineer" ? { OR: [{ engineerId: userId }, { project: { projectMembers: { some: { userId, status: "accepted" } } } }] } :
                    { project: { projectMembers: { some: { userId, status: "accepted" } } } };
        return await db_js_1.default.milestone.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(status ? { status } : {}),
                ...roleFilter,
            },
            include: {
                project: true,
                engineer: { select: engineerSelect },
                _count: { select: { boqItems: true, inspections: true, rfqs: true, progressPhotos: true, disputes: true, transactions: true } },
            },
            orderBy: [{ projectId: "asc" }, { order: "asc" }, { createdAt: "desc" }],
        });
    }
    static async getMilestoneById(milestoneId, userId, userRole) {
        const milestone = await db_js_1.default.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                project: { include: { projectMembers: true } },
                engineer: { select: engineerSelect },
                boqItems: true, inspections: true, progressPhotos: true, rfqs: true, transactions: true, disputes: true,
            },
        });
        if (!milestone)
            throw new Error("Milestone not found");
        if (!canReadMilestones(milestone.project, userId, userRole))
            throw new Error("Forbidden");
        return milestone;
    }
    static async updateMilestone(milestoneId, body, userId, userRole) {
        if (body.status !== undefined && !isMilestoneStatus(body.status))
            throw new Error("Invalid milestone status");
        const existing = await db_js_1.default.milestone.findUnique({
            where: { id: milestoneId },
            include: { project: { include: { milestones: true, projectMembers: true } } },
        });
        if (!existing)
            throw new Error("Milestone not found");
        if (!canManageMilestone(existing, userId, userRole, body))
            throw new Error("Forbidden");
        if (body.dependsOn) {
            const dep = await db_js_1.default.milestone.findFirst({
                where: { id: String(body.dependsOn), projectId: existing.projectId, NOT: { id: milestoneId } },
            });
            if (!dep)
                throw new Error("dependsOn milestone must belong to the same project");
        }
        if (body.budgetPercentage !== undefined) {
            const nextTotal = existing.project.milestones.reduce((sum, m) => sum + (m.id === milestoneId ? Number(body.budgetPercentage) : Number(m.budgetPercentage)), 0);
            if (nextTotal > 100)
                throw new Error("Total milestone budget percentage cannot exceed 100");
        }
        return await db_js_1.default.milestone.update({
            where: { id: milestoneId },
            data: buildUpdateData(body),
            include: { project: true, engineer: { select: engineerSelect } },
        });
    }
    static async deleteMilestone(milestoneId, userId, userRole) {
        const milestone = await db_js_1.default.milestone.findUnique({
            where: { id: milestoneId },
            include: { _count: { select: { inspections: true, rfqs: true, transactions: true, progressPhotos: true, disputes: true } } },
        });
        if (!milestone)
            throw new Error("Milestone not found");
        if (userRole !== "admin" && !(userRole === "engineer" && milestone.engineerId === userId))
            throw new Error("Forbidden");
        const hasDependent = Object.values(milestone._count).some((count) => count > 0);
        if (hasDependent)
            throw new Error("Milestone has dependent records and cannot be deleted");
        await db_js_1.default.milestone.delete({ where: { id: milestoneId } });
    }
}
exports.MilestoneService = MilestoneService;

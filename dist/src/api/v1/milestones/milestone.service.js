"use strict";
/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : milestone.service.ts
 * WHAT THIS FILE DOES : Handles all Milestone CRUD, permission checks, budget
 *                      validation, and milestone-approval fund releases.
 * HOW IT DOES IT      : Queries Prisma ORM with role-based filters and
 *                      enforces business rules inside Prisma transactions.
 * DATA SOURCE         : Controller parameters (milestoneId, projectId, user)
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
const wallet_queue_js_1 = require("../../../queues/wallet.queue.js");
// ============================================================================
// 🔧 HELPERS
// ============================================================================
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
        const clientOwnsProject = milestone.project.clientId === userId;
        const onlyFinancialApproval = clientOwnsProject &&
            body?.status === "active" &&
            Object.keys(body).every((key) => ["status"].includes(key));
        const onlyRequestsRevision = clientOwnsProject &&
            body?.status === "revision_required" &&
            Object.keys(body).every((key) => ["status", "revisionNotes", "clientNotes"].includes(key));
        return onlyFinancialApproval || onlyRequestsRevision;
    }
    if (role === "engineer")
        return milestone.engineerId === userId;
    if (role === "supervisor") {
        return Boolean(milestone.project.projectMembers?.some((m) => m.userId === userId &&
            m.role === "supervisor" &&
            m.status === "accepted"));
    }
    return false;
};
const isMilestoneStatus = (value) => typeof value === "string" &&
    Object.values(client_1.MilestoneStatus).includes(value);
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
        if (body.status === "pending_client_approval")
            data.completedAt = new Date();
    }
    if (body.completedAt !== undefined)
        data.completedAt = body.completedAt
            ? new Date(String(body.completedAt))
            : null;
    if (body.paidAt !== undefined)
        data.paidAt = body.paidAt ? new Date(String(body.paidAt)) : null;
    return data;
};
const validateStatusWorkflow = async (milestone, nextStatus, userRole) => {
    const normalizedRole = String(userRole || "").trim().toLowerCase();
    if (normalizedRole === "admin")
        return;
    if (normalizedRole === "engineer") {
        if (nextStatus !== "pending_client_approval") {
            throw new Error("Main Contractors can only submit milestone packages for client approval");
        }
        if (!["pending", "active", "revision_required"].includes(milestone.status)) {
            throw new Error("Only pending, active, or revision-required milestones can be submitted for client approval");
        }
        const boqCount = await db_js_1.default.boqItem.count({
            where: { milestoneId: milestone.id },
        });
        if (boqCount < 1) {
            throw new Error("Add at least one BOQ item before sending the milestone package for client approval");
        }
        return;
    }
    if (normalizedRole === "supervisor") {
        if (!["awaiting_client_payment", "revision_required"].includes(nextStatus)) {
            throw new Error("Supervisors can only approve for client payment or request revision");
        }
        if (milestone.status !== "active" && milestone.status !== "pending_supervisor") {
            throw new Error("Only active milestones can be inspected");
        }
        return;
    }
    if (normalizedRole === "client") {
        if (!["active", "revision_required"].includes(nextStatus)) {
            throw new Error("Clients can only approve funding or request revision from this endpoint");
        }
        if (nextStatus === "revision_required" && !["pending_client_approval", "awaiting_client_payment"].includes(milestone.status)) {
            throw new Error("Client revision is only available during client approval or after supervisor approval");
        }
        if (nextStatus === "active") {
            if (milestone.status !== "pending_client_approval") {
                throw new Error("Client approval is only available when the milestone package is pending client approval");
            }
            const boqItems = await db_js_1.default.boqItem.findMany({
                where: { milestoneId: milestone.id },
                select: { totalPrice: true },
            });
            const boqTotal = boqItems.reduce((sum, item) => sum.plus(item.totalPrice), new client_1.Prisma.Decimal(0));
            if (boqTotal.lte(0)) {
                throw new Error("Milestone BOQ total must be greater than zero before approval");
            }
            const escrow = await db_js_1.default.escrowAccount.findUnique({
                where: { projectId: milestone.projectId },
            });
            if (!escrow) {
                throw new Error("Project wallet was not found. Fund the project wallet before approval");
            }
            if (escrow.balance.lt(boqTotal)) {
                throw new Error(`Insufficient project wallet balance. Required ${boqTotal.toString()} ${escrow.currency}`);
            }
        }
    }
};
const engineerSelect = {
    id: true,
    name: true,
    email: true,
    image: true,
    role: true,
};
// ============================================================================
// 📦 MILESTONE SERVICE
// ============================================================================
class MilestoneService {
    // ──────────────────────────────────────────────────────────────────────
    // CREATE
    // ──────────────────────────────────────────────────────────────────────
    static async createMilestone(body, userId, userRole) {
        const { projectId, name, description, budgetPercentage, durationDays, acceptanceCriteria, dependsOn, order, status, } = body;
        if (!projectId || !name || order === undefined) {
            throw new Error("projectId, name and order are required");
        }
        if (status !== undefined && !isMilestoneStatus(status)) {
            throw new Error("Invalid milestone status");
        }
        const project = await db_js_1.default.project.findUnique({
            where: { id: String(projectId) },
            include: { milestones: true, projectMembers: true },
        });
        if (!project)
            throw new Error("Project not found");
        if (userRole !== "admin" && project.engineerId !== userId) {
            throw new Error("ENGINEER_ONLY");
        }
        const engineerId = userRole === "admin" ? project.engineerId || userId : userId;
        if (!engineerId)
            throw new Error("Project has no accepted engineer");
        if (dependsOn) {
            const dep = await db_js_1.default.milestone.findFirst({
                where: { id: String(dependsOn), projectId: project.id },
            });
            if (!dep)
                throw new Error("dependsOn milestone must belong to the same project");
        }
        const nextBudgetPercentage = budgetPercentage === undefined ? 0 : Number(budgetPercentage);
        const nextTotal = project.milestones.reduce((sum, m) => sum + Number(m.budgetPercentage), nextBudgetPercentage);
        if (nextTotal > 100)
            throw new Error("Total milestone budget percentage cannot exceed 100");
        return db_js_1.default.milestone.create({
            data: {
                projectId: project.id,
                engineerId,
                name: String(name),
                description,
                budgetPercentage: String(nextBudgetPercentage),
                durationDays: durationDays !== undefined ? Number(durationDays) : undefined,
                acceptanceCriteria,
                dependsOn: dependsOn || undefined,
                order: Number(order),
                status: status || undefined,
            },
            include: { project: true, engineer: { select: engineerSelect } },
        });
    }
    // ──────────────────────────────────────────────────────────────────────
    // READ (list)
    // ──────────────────────────────────────────────────────────────────────
    static async getMilestones(query, userId, userRole) {
        const projectId = typeof query.projectId === "string" ? query.projectId : undefined;
        const status = typeof query.status === "string" ? query.status : undefined;
        if (status !== undefined && !isMilestoneStatus(status)) {
            throw new Error("Invalid milestone status");
        }
        const roleFilter = userRole === "admin"
            ? {}
            : userRole === "client"
                ? { project: { clientId: userId } }
                : userRole === "engineer"
                    ? {
                        OR: [
                            { engineerId: userId },
                            {
                                project: {
                                    projectMembers: { some: { userId, status: "accepted" } },
                                },
                            },
                        ],
                    }
                    : {
                        project: {
                            projectMembers: { some: { userId, status: "accepted" } },
                        },
                    };
        return db_js_1.default.milestone.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(status ? { status } : {}),
                ...roleFilter,
            },
            include: {
                project: true,
                engineer: { select: engineerSelect },
                boqItems: {
                    include: {
                        supplierInventoryItem: {
                            include: {
                                supplier: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        image: true,
                                        role: true,
                                    },
                                },
                            },
                        },
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
                inspections: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        supervisor: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                image: true,
                                role: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ projectId: "asc" }, { order: "asc" }, { createdAt: "desc" }],
        });
    }
    // ──────────────────────────────────────────────────────────────────────
    // READ (single)
    // ──────────────────────────────────────────────────────────────────────
    static async getMilestoneById(milestoneId, userId, userRole) {
        const milestone = await db_js_1.default.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                project: { include: { projectMembers: true } },
                engineer: { select: engineerSelect },
                boqItems: {
                    include: {
                        supplierInventoryItem: {
                            include: {
                                supplier: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        image: true,
                                        role: true,
                                    },
                                },
                            },
                        },
                    },
                },
                inspections: true,
                progressPhotos: true,
                rfqs: true,
                transactions: true,
                disputes: true,
            },
        });
        if (!milestone)
            throw new Error("Milestone not found");
        if (!canReadMilestones(milestone.project, userId, userRole)) {
            throw new Error("Forbidden");
        }
        return milestone;
    }
    // ──────────────────────────────────────────────────────────────────────
    // UPDATE
    // ──────────────────────────────────────────────────────────────────────
    static async updateMilestone(milestoneId, body, userId, userRole) {
        if (body.status !== undefined && !isMilestoneStatus(body.status)) {
            throw new Error("Invalid milestone status");
        }
        const existing = await db_js_1.default.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                project: { include: { milestones: true, projectMembers: true } },
            },
        });
        if (!existing)
            throw new Error("Milestone not found");
        if (!canManageMilestone(existing, userId, userRole, body)) {
            throw new Error("Forbidden");
        }
        if (body.status !== undefined) {
            await validateStatusWorkflow(existing, body.status, userRole);
        }
        if (body.dependsOn) {
            const dep = await db_js_1.default.milestone.findFirst({
                where: {
                    id: String(body.dependsOn),
                    projectId: existing.projectId,
                    NOT: { id: milestoneId },
                },
            });
            if (!dep) {
                throw new Error("dependsOn milestone must belong to the same project");
            }
        }
        if (body.budgetPercentage !== undefined) {
            const nextTotal = existing.project.milestones.reduce((sum, m) => sum +
                (m.id === milestoneId
                    ? Number(body.budgetPercentage)
                    : Number(m.budgetPercentage)), 0);
            if (nextTotal > 100) {
                throw new Error("Total milestone budget percentage cannot exceed 100");
            }
        }
        return db_js_1.default.milestone.update({
            where: { id: milestoneId },
            data: buildUpdateData(body),
            include: { project: true, engineer: { select: engineerSelect } },
        });
    }
    // ──────────────────────────────────────────────────────────────────────
    // DELETE
    // ──────────────────────────────────────────────────────────────────────
    static async deleteMilestone(milestoneId, userId, userRole) {
        const milestone = await db_js_1.default.milestone.findUnique({
            where: { id: milestoneId },
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
        if (!milestone)
            throw new Error("Milestone not found");
        if (userRole !== "admin" &&
            !(userRole === "engineer" && milestone.engineerId === userId)) {
            throw new Error("Forbidden");
        }
        const hasDependent = Object.values(milestone._count).some((count) => count > 0);
        if (hasDependent)
            throw new Error("Milestone has dependent records and cannot be deleted");
        await db_js_1.default.milestone.delete({ where: { id: milestoneId } });
    }
    // ──────────────────────────────────────────────────────────────────────
    // 💰 RELEASE MILESTONE FUNDS
    // Called when supervisor/client approves a milestone.
    // Releases locked funds from the vault to the engineer's wallet.
    // ──────────────────────────────────────────────────────────────────────
    static async releaseMilestoneFunds(milestoneId, approverId, approverRole) {
        return db_js_1.default
            .$transaction(async (tx) => {
            const milestone = await tx.milestone.findUnique({
                where: { id: milestoneId },
                include: {
                    project: { include: { escrowAccount: true } },
                    engineer: true,
                },
            });
            if (!milestone)
                throw new Error("Milestone not found");
            if (milestone.status === "paid")
                throw new Error("Milestone already paid");
            // ── Permission check ──
            const isProjectOwner = milestone.project.clientId === approverId;
            const isSupervisor = approverRole === "supervisor" || approverRole === "admin";
            if (!isProjectOwner && !isSupervisor) {
                throw new Error("Forbidden: only client or supervisor can release funds");
            }
            const escrow = milestone.project.escrowAccount;
            if (!escrow)
                throw new Error("Project has no escrow account");
            // ── Compute payout ──
            const payoutAmount = new client_1.Prisma.Decimal(milestone.project.budget)
                .mul(new client_1.Prisma.Decimal(milestone.budgetPercentage))
                .div(100);
            if (escrow.balance.lt(payoutAmount)) {
                throw new Error("Insufficient escrow balance for payout");
            }
            // ── Debit vault ──
            await tx.escrowAccount.update({
                where: { id: escrow.id },
                data: { balance: { decrement: payoutAmount } },
            });
            await tx.transaction.create({
                data: {
                    escrowAccountId: escrow.id,
                    milestoneId: milestone.id,
                    actorId: approverId,
                    type: "release",
                    method: "bank_transfer",
                    amount: payoutAmount,
                    status: "completed",
                    reference: `REL-${milestone.id}-${Date.now()}`,
                    completedAt: new Date(),
                    metadata: {
                        reason: "milestone_approved",
                        milestoneName: milestone.name,
                    },
                },
            });
            // ── Credit engineer wallet ──
            const engineerWallet = await tx.wallet.findUnique({
                where: { userId: milestone.engineerId },
            });
            if (!engineerWallet)
                throw new Error("Engineer wallet not found");
            const walletBefore = engineerWallet.balance;
            const walletAfter = walletBefore.plus(payoutAmount);
            await tx.wallet.update({
                where: { id: engineerWallet.id },
                data: { balance: { increment: payoutAmount } },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId: engineerWallet.id,
                    type: "milestone_payout",
                    amount: payoutAmount,
                    balanceBefore: walletBefore,
                    balanceAfter: walletAfter,
                    currency: engineerWallet.currency,
                    status: "completed",
                    escrowAccountId: escrow.id,
                    milestoneId: milestone.id,
                    completedAt: new Date(),
                    description: `Milestone payout: ${milestone.name}`,
                    reference: `PAY-${milestone.id}-${Date.now()}`,
                },
            });
            // ── Update milestone status ──
            await tx.milestone.update({
                where: { id: milestone.id },
                data: { status: "paid", paidAt: new Date() },
            });
            // ── Audit log ──
            await tx.auditLog.create({
                data: {
                    actorId: approverId,
                    action: "MILESTONE_FUNDS_RELEASED",
                    entityType: "Milestone",
                    entityId: milestone.id,
                    projectId: milestone.projectId,
                    newValues: {
                        payoutAmount: payoutAmount.toString(),
                        status: "paid",
                    },
                    result: "success",
                },
            });
            return { payoutAmount, milestone, engineerId: milestone.engineerId };
        })
            .then(async (result) => {
            // Fire async event AFTER transaction commits
            // In releaseMilestoneFunds
            await wallet_queue_js_1.walletQueue.add("wallet.milestone_payout", {
                walletId: result.milestone.engineerId,
                milestoneId: result.milestone.id,
                amount: Number(result.payoutAmount),
                recipientId: result.engineerId,
            });
            return result;
        });
    }
}
exports.MilestoneService = MilestoneService;

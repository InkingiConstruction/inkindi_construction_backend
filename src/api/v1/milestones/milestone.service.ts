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

import { MilestoneStatus, Prisma } from "@prisma/client";
import prisma from "../../../config/db.js";
import { walletQueue } from "../../../queues/wallet.queue.js";

const canReadMilestones = (project: any, userId: string, role: string) => {
  if (role === "admin") return true;
  if (project.clientId === userId) return true;
  if (project.engineerId === userId) return true;
  return Boolean(project.projectMembers?.some((m: any) => m.userId === userId && m.status === "accepted"));
};

const canManageMilestone = (milestone: any, userId: string, role: string) => {
  if (role === "admin") return true;
  if (role === "engineer") return milestone.engineerId === userId;
  if (role === "supervisor") {
    return Boolean(
      milestone.project.projectMembers?.some(
        (m: any) => m.userId === userId && m.role === "supervisor" && m.status === "accepted"
      )
    );
  }
  return false;
};

const isMilestoneStatus = (value: unknown): value is MilestoneStatus =>
  typeof value === "string" && Object.values(MilestoneStatus).includes(value as MilestoneStatus);

const buildUpdateData = (body: Record<string, unknown>): Prisma.MilestoneUpdateInput => {
  const data: Prisma.MilestoneUpdateInput = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.description !== undefined) data.description = String(body.description);
  if (body.budgetPercentage !== undefined) data.budgetPercentage = String(body.budgetPercentage);
  if (body.durationDays !== undefined) data.durationDays = Number(body.durationDays);
  if (body.acceptanceCriteria !== undefined) data.acceptanceCriteria = String(body.acceptanceCriteria);
  if (body.dependsOn !== undefined) data.dependsOn = body.dependsOn ? String(body.dependsOn) : null;
  if (body.order !== undefined) data.order = Number(body.order);
  if (body.status !== undefined) {
    data.status = body.status as MilestoneStatus;
    if (body.status === "paid") data.paidAt = new Date();
    if (body.status === "pending_supervisor") data.completedAt = new Date();
  }
  if (body.completedAt !== undefined) data.completedAt = body.completedAt ? new Date(String(body.completedAt)) : null;
  if (body.paidAt !== undefined) data.paidAt = body.paidAt ? new Date(String(body.paidAt)) : null;
  return data;
};

const engineerSelect = { id: true, name: true, email: true, image: true, role: true };

export class MilestoneService {
  static async createMilestone(body: any, userId: string, userRole: string) {
    const { projectId, name, description, budgetPercentage, durationDays, acceptanceCriteria, dependsOn, order, status } = body;

    if (!projectId || !name || budgetPercentage === undefined || order === undefined) {
      throw new Error("projectId, name, budgetPercentage and order are required");
    }
    if (status !== undefined && !isMilestoneStatus(status)) throw new Error("Invalid milestone status");

    const project = await prisma.project.findUnique({
      where: { id: String(projectId) },
      include: { milestones: true, projectMembers: true },
    });

    if (!project) throw new Error("Project not found");
    if (userRole !== "admin" && project.engineerId !== userId) throw new Error("ENGINEER_ONLY");

    const engineerId = userRole === "admin" ? project.engineerId || userId : userId;
    if (!engineerId) throw new Error("Project has no accepted engineer");

    if (dependsOn) {
      const dep = await prisma.milestone.findFirst({ where: { id: String(dependsOn), projectId: project.id } });
      if (!dep) throw new Error("dependsOn milestone must belong to the same project");
    }

    const nextTotal = project.milestones.reduce((sum, m) => sum + Number(m.budgetPercentage), Number(budgetPercentage));
    if (nextTotal > 100) throw new Error("Total milestone budget percentage cannot exceed 100");

    return await prisma.milestone.create({
      data: {
        projectId: project.id, engineerId: engineerId!, name: String(name), description,
        budgetPercentage: String(budgetPercentage),
        durationDays: durationDays !== undefined ? Number(durationDays) : undefined,
        acceptanceCriteria, dependsOn: dependsOn || undefined, order: Number(order), status: status || undefined,
      },
      include: { project: true, engineer: { select: engineerSelect } },
    });
  }

  static async getMilestones(query: any, userId: string, userRole: string) {
    const projectId = typeof query.projectId === "string" ? query.projectId : undefined;
    const status = typeof query.status === "string" ? query.status : undefined;

    if (status !== undefined && !isMilestoneStatus(status)) throw new Error("Invalid milestone status");

    const roleFilter: Prisma.MilestoneWhereInput =
      userRole === "admin" ? {} :
      userRole === "client" ? { project: { clientId: userId } } :
      userRole === "engineer" ? { OR: [{ engineerId: userId }, { project: { projectMembers: { some: { userId, status: "accepted" } } } }] } :
      { project: { projectMembers: { some: { userId, status: "accepted" } } } };

    return await prisma.milestone.findMany({
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

  static async getMilestoneById(milestoneId: string, userId: string, userRole: string) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: { include: { projectMembers: true } },
        engineer: { select: engineerSelect },
        boqItems: true, inspections: true, progressPhotos: true, rfqs: true, transactions: true, disputes: true,
      },
    });

    if (!milestone) throw new Error("Milestone not found");
    if (!canReadMilestones(milestone.project, userId, userRole)) throw new Error("Forbidden");

    return milestone;
  }

  static async updateMilestone(milestoneId: string, body: any, userId: string, userRole: string) {
    if (body.status !== undefined && !isMilestoneStatus(body.status)) throw new Error("Invalid milestone status");

    const existing = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: { include: { milestones: true, projectMembers: true } } },
    });

    if (!existing) throw new Error("Milestone not found");
    if (!canManageMilestone(existing, userId, userRole)) throw new Error("Forbidden");

    if (body.dependsOn) {
      const dep = await prisma.milestone.findFirst({
        where: { id: String(body.dependsOn), projectId: existing.projectId, NOT: { id: milestoneId } },
      });
      if (!dep) throw new Error("dependsOn milestone must belong to the same project");
    }

    if (body.budgetPercentage !== undefined) {
      const nextTotal = existing.project.milestones.reduce(
        (sum, m) => sum + (m.id === milestoneId ? Number(body.budgetPercentage) : Number(m.budgetPercentage)), 0
      );
      if (nextTotal > 100) throw new Error("Total milestone budget percentage cannot exceed 100");
    }

    return await prisma.milestone.update({
      where: { id: milestoneId },
      data: buildUpdateData(body),
      include: { project: true, engineer: { select: engineerSelect } },
    });
  }

  static async deleteMilestone(milestoneId: string, userId: string, userRole: string) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { _count: { select: { inspections: true, rfqs: true, transactions: true, progressPhotos: true, disputes: true } } },
    });

    if (!milestone) throw new Error("Milestone not found");
    if (userRole !== "admin" && !(userRole === "engineer" && milestone.engineerId === userId)) throw new Error("Forbidden");

    const hasDependent = Object.values(milestone._count).some((count) => count > 0);
    if (hasDependent) throw new Error("Milestone has dependent records and cannot be deleted");

    await prisma.milestone.delete({ where: { id: milestoneId } });
  }

  /**
 * Called when supervisor/client approves a milestone.
 * Releases locked funds from the vault to the engineer's wallet.
 */
export const releaseMilestoneFunds = async (milestoneId: string, approverId: string) => {
  return prisma.$transaction(async (tx) => {
    const milestone = await tx.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: { include: { escrowAccount: true } },
        engineer: true,
      },
    });
    if (!milestone) throw new Error("Milestone not found");
    if (milestone.status === "paid") throw new Error("Milestone already paid");

    const escrow = milestone.project.escrowAccount;
    if (!escrow) throw new Error("Project has no escrow account");

    // Compute payout from project budget * milestone percentage
    const payoutAmount = new Prisma.Decimal(milestone.project.budget)
      .mul(new Prisma.Decimal(milestone.budgetPercentage))
      .div(100);

    if (escrow.balance.lt(payoutAmount)) {
      throw new Error("Insufficient escrow balance for payout");
    }

    // Debit vault
    const vaultBefore = escrow.balance;
    const vaultAfter = vaultBefore.minus(payoutAmount);

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
        metadata: { reason: "milestone_approved", milestoneName: milestone.name },
      },
    });

    // Credit engineer wallet
    const engineerWallet = await tx.wallet.findUnique({
      where: { userId: milestone.engineerId },
    });
    if (!engineerWallet) throw new Error("Engineer wallet not found");

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

    // Update milestone status
    await tx.milestone.update({
      where: { id: milestone.id },
      data: { status: "paid", paidAt: new Date() },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: approverId,
        action: "MILESTONE_FUNDS_RELEASED",
        entityType: "Milestone",
        entityId: milestone.id,
        projectId: milestone.projectId,
        newValues: { payoutAmount: payoutAmount.toString(), status: "paid" },
        result: "success",
      },
    });

    return { payoutAmount, milestone, engineerId: milestone.engineerId };
  }).then(async (result) => {
    await walletQueue.add("wallet.milestone_payout", {
      type: "wallet.milestone_payout",
      walletId: result.milestone.engineerId,
      milestoneId: result.milestone.id,
      amount: Number(result.payoutAmount),
      recipientId: result.engineerId,
    });
    return result;
  });
};
/**
 * Called when supervisor/client approves a milestone.
 * Releases locked funds from the vault to the engineer's wallet.
 */
export const releaseMilestoneFunds = async (milestoneId: string, approverId: string) => {
  return prisma.$transaction(async (tx) => {
    const milestone = await tx.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: { include: { escrowAccount: true } },
        engineer: true,
      },
    });
    if (!milestone) throw new Error("Milestone not found");
    if (milestone.status === "paid") throw new Error("Milestone already paid");

    const escrow = milestone.project.escrowAccount;
    if (!escrow) throw new Error("Project has no escrow account");

    // Compute payout from project budget * milestone percentage
    const payoutAmount = new Prisma.Decimal(milestone.project.budget)
      .mul(new Prisma.Decimal(milestone.budgetPercentage))
      .div(100);

    if (escrow.balance.lt(payoutAmount)) {
      throw new Error("Insufficient escrow balance for payout");
    }

    // Debit vault
    const vaultBefore = escrow.balance;
    const vaultAfter = vaultBefore.minus(payoutAmount);

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
        metadata: { reason: "milestone_approved", milestoneName: milestone.name },
      },
    });

    // Credit engineer wallet
    const engineerWallet = await tx.wallet.findUnique({
      where: { userId: milestone.engineerId },
    });
    if (!engineerWallet) throw new Error("Engineer wallet not found");

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

    // Update milestone status
    await tx.milestone.update({
      where: { id: milestone.id },
      data: { status: "paid", paidAt: new Date() },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: approverId,
        action: "MILESTONE_FUNDS_RELEASED",
        entityType: "Milestone",
        entityId: milestone.id,
        projectId: milestone.projectId,
        newValues: { payoutAmount: payoutAmount.toString(), status: "paid" },
        result: "success",
      },
    });

    return { payoutAmount, milestone, engineerId: milestone.engineerId };
  }).then(async (result) => {
    await walletQueue.add("wallet.milestone_payout", {
      type: "wallet.milestone_payout",
      walletId: result.milestone.engineerId,
      milestoneId: result.milestone.id,
      amount: Number(result.payoutAmount),
      recipientId: result.engineerId,
    });
    return result;
  });
};
}

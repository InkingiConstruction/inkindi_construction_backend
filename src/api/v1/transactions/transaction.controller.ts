import { Request, Response } from "express";
import {
  PaymentMethod,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import prisma from "../../../config/db.js";

const getParamId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const parseJsonField = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value !== "string") return value as Prisma.InputJsonValue;

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return value;
  }
};

const isTransactionType = (value: unknown): value is TransactionType =>
  typeof value === "string" &&
  Object.values(TransactionType).includes(value as TransactionType);

const isTransactionStatus = (value: unknown): value is TransactionStatus =>
  typeof value === "string" &&
  Object.values(TransactionStatus).includes(value as TransactionStatus);

const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === "string" &&
  Object.values(PaymentMethod).includes(value as PaymentMethod);

const canReadProjectTransactions = (
  project: {
    clientId: string;
    engineerId: string | null;
    projectMembers?: { userId: string; status: string }[];
  },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  if (project.clientId === userId) return true;
  if (project.engineerId === userId) return true;
  return Boolean(
    project.projectMembers?.some(
      (member) => member.userId === userId && member.status === "accepted",
    ),
  );
};

const canCreateTransaction = (
  type: TransactionType,
  project: { clientId: string },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  if (role !== "client" || project.clientId !== userId) return false;
  return type === "deposit" || type === "release";
};

const validateMilestone = async (
  milestoneId: unknown,
  projectId: string,
  type: TransactionType,
) => {
  if (!milestoneId) return null;

  const milestone = await prisma.milestone.findFirst({
    where: {
      id: String(milestoneId),
      projectId,
    },
  });

  if (!milestone) {
    return {
      error: {
        status: 400,
        body: { message: "milestoneId must belong to the escrow project" },
      },
      milestone: null,
    };
  }

  if (
    (type === "release" || type === "auto_payment") &&
    milestone.status !== "awaiting_client_payment"
  ) {
    return {
      error: {
        status: 400,
        body: {
          message:
            "Milestone must be awaiting_client_payment before money can be released",
          currentStatus: milestone.status,
        },
      },
      milestone,
    };
  }

  return { error: null, milestone };
};

const applyCompletedTransaction = (
  escrowAccount: {
    balance: Prisma.Decimal;
    lockedBalance: Prisma.Decimal;
  },
  type: TransactionType,
  amount: Prisma.Decimal,
) => {
  const nextBalance = new Prisma.Decimal(escrowAccount.balance);
  const nextLockedBalance = new Prisma.Decimal(escrowAccount.lockedBalance);

  if (type === "deposit") {
    return {
      balance: nextBalance.plus(amount),
      lockedBalance: nextLockedBalance,
    };
  }

  if (type === "freeze") {
    if (nextBalance.lessThan(amount)) {
      return { error: "Insufficient available escrow balance" };
    }

    return {
      balance: nextBalance.minus(amount),
      lockedBalance: nextLockedBalance.plus(amount),
    };
  }

  if (type === "unfreeze") {
    if (nextLockedBalance.lessThan(amount)) {
      return { error: "Insufficient locked escrow balance" };
    }

    return {
      balance: nextBalance.plus(amount),
      lockedBalance: nextLockedBalance.minus(amount),
    };
  }

  if (
    type === "release" ||
    type === "refund" ||
    type === "auto_payment" ||
    type === "penalty"
  ) {
    if (nextBalance.lessThan(amount)) {
      return { error: "Insufficient available escrow balance" };
    }

    return {
      balance: nextBalance.minus(amount),
      lockedBalance: nextLockedBalance,
    };
  }

  return {
    balance: nextBalance,
    lockedBalance: nextLockedBalance,
  };
};

const reverseCompletedTransaction = (
  escrowAccount: {
    balance: Prisma.Decimal;
    lockedBalance: Prisma.Decimal;
  },
  type: TransactionType,
  amount: Prisma.Decimal,
) => {
  const nextBalance = new Prisma.Decimal(escrowAccount.balance);
  const nextLockedBalance = new Prisma.Decimal(escrowAccount.lockedBalance);

  if (type === "deposit") {
    if (nextBalance.lessThan(amount)) {
      return { error: "Insufficient available escrow balance to reverse deposit" };
    }

    return {
      balance: nextBalance.minus(amount),
      lockedBalance: nextLockedBalance,
    };
  }

  if (type === "freeze") {
    if (nextLockedBalance.lessThan(amount)) {
      return { error: "Insufficient locked escrow balance to reverse freeze" };
    }

    return {
      balance: nextBalance.plus(amount),
      lockedBalance: nextLockedBalance.minus(amount),
    };
  }

  if (type === "unfreeze") {
    if (nextBalance.lessThan(amount)) {
      return { error: "Insufficient available escrow balance to reverse unfreeze" };
    }

    return {
      balance: nextBalance.minus(amount),
      lockedBalance: nextLockedBalance.plus(amount),
    };
  }

  if (
    type === "release" ||
    type === "refund" ||
    type === "auto_payment" ||
    type === "penalty"
  ) {
    return {
      balance: nextBalance.plus(amount),
      lockedBalance: nextLockedBalance,
    };
  }

  return {
    balance: nextBalance,
    lockedBalance: nextLockedBalance,
  };
};

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const {
      escrowAccountId,
      projectId,
      milestoneId,
      type,
      method,
      amount,
      status,
      reference,
      metadata,
    } = req.body;

    if (!escrowAccountId && !projectId) {
      return res.status(400).json({
        message: "escrowAccountId or projectId is required",
      });
    }

    if (!type || !amount) {
      return res.status(400).json({
        message: "type and amount are required",
      });
    }

    if (!isTransactionType(type)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    if (status !== undefined && !isTransactionStatus(status)) {
      return res.status(400).json({ message: "Invalid transaction status" });
    }

    if (method !== undefined && method !== null && !isPaymentMethod(method)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const transactionAmount = new Prisma.Decimal(amount);

    if (transactionAmount.lessThanOrEqualTo(0)) {
      return res.status(400).json({ message: "amount must be greater than 0" });
    }

    const escrowAccount = await prisma.escrowAccount.findFirst({
      where: {
        ...(escrowAccountId
          ? { id: String(escrowAccountId) }
          : { projectId: String(projectId) }),
      },
      include: {
        project: true,
      },
    });

    if (!escrowAccount) {
      return res.status(404).json({ message: "Escrow account not found" });
    }

    if (
      !canCreateTransaction(
        type,
        escrowAccount.project,
        req.user.id,
        req.user.role,
      )
    ) {
      return res.status(403).json({
        message:
          "Only the project client can create deposits or releases, and admin can create all transaction types",
      });
    }

    const milestoneResult = await validateMilestone(
      milestoneId,
      escrowAccount.projectId,
      type,
    );

    if (milestoneResult?.error) {
      return res
        .status(milestoneResult.error.status)
        .json(milestoneResult.error.body);
    }

    const nextStatus = status || "pending";
    const transaction = await prisma.$transaction(async (tx) => {
      let nextEscrowBalance:
        | {
            balance: Prisma.Decimal;
            lockedBalance: Prisma.Decimal;
          }
        | undefined;

      if (nextStatus === "completed") {
        const applied = applyCompletedTransaction(
          escrowAccount,
          type,
          transactionAmount,
        );

        if ("error" in applied) {
          throw new Error(applied.error);
        }

        nextEscrowBalance = applied;

        await tx.escrowAccount.update({
          where: { id: escrowAccount.id },
          data: {
            balance: applied.balance,
            lockedBalance: applied.lockedBalance,
          },
        });

        if (
          milestoneId &&
          (type === "release" || type === "auto_payment")
        ) {
          await tx.milestone.update({
            where: { id: String(milestoneId) },
            data: {
              status: "paid",
              paidAt: new Date(),
            },
          });
        }
      }

      const createdTransaction = await tx.transaction.create({
        data: {
          escrowAccountId: escrowAccount.id,
          milestoneId: milestoneId ? String(milestoneId) : undefined,
          actorId: req.user.id,
          type,
          method: method || undefined,
          amount: transactionAmount,
          status: nextStatus,
          reference,
          metadata: parseJsonField(metadata),
          completedAt: nextStatus === "completed" ? new Date() : undefined,
        },
        include: {
          escrowAccount: true,
          milestone: true,
          actor: {
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

      return {
        ...createdTransaction,
        escrowAccount: nextEscrowBalance
          ? {
              ...createdTransaction.escrowAccount,
              balance: nextEscrowBalance.balance,
              lockedBalance: nextEscrowBalance.lockedBalance,
            }
          : createdTransaction.escrowAccount,
      };
    });

    return res.status(201).json({
      message: "Transaction created successfully",
      transaction,
    });
  } catch (error) {
    console.error("Create transaction error:", error);

    if (error instanceof Error && error.message.includes("balance")) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const escrowAccountId =
      typeof req.query.escrowAccountId === "string"
        ? req.query.escrowAccountId
        : undefined;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const milestoneId =
      typeof req.query.milestoneId === "string"
        ? req.query.milestoneId
        : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;

    if (status !== undefined && !isTransactionStatus(status)) {
      return res.status(400).json({ message: "Invalid transaction status" });
    }

    if (type !== undefined && !isTransactionType(type)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(escrowAccountId ? { escrowAccountId } : {}),
        ...(milestoneId ? { milestoneId } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        escrowAccount: {
          ...(projectId ? { projectId } : {}),
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
      },
      include: {
        escrowAccount: {
          include: {
            project: true,
          },
        },
        milestone: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        escrowAccount: {
          include: {
            project: {
              include: {
                projectMembers: true,
              },
            },
          },
        },
        milestone: true,
        actor: {
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

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (
      !canReadProjectTransactions(
        transaction.escrowAccount.project,
        req.user.id,
        req.user.role,
      )
    ) {
      return res.status(403).json({
        message: "You do not have access to this transaction",
      });
    }

    return res.json(transaction);
  } catch (error) {
    console.error("Get transaction by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { method, status, reference, metadata } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    if (status !== undefined && !isTransactionStatus(status)) {
      return res.status(400).json({ message: "Invalid transaction status" });
    }

    if (method !== undefined && method !== null && !isPaymentMethod(method)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const existingTransaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        escrowAccount: true,
        milestone: true,
      },
    });

    if (!existingTransaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const nextStatus = status || existingTransaction.status;

    if (
      nextStatus === "completed" &&
      existingTransaction.status !== "completed" &&
      existingTransaction.milestoneId &&
      (existingTransaction.type === "release" ||
        existingTransaction.type === "auto_payment") &&
      existingTransaction.milestone?.status !== "awaiting_client_payment"
    ) {
      return res.status(400).json({
        message:
          "Milestone must be awaiting_client_payment before money can be released",
        currentStatus: existingTransaction.milestone?.status,
      });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      if (
        existingTransaction.status !== "completed" &&
        nextStatus === "completed"
      ) {
        const applied = applyCompletedTransaction(
          existingTransaction.escrowAccount,
          existingTransaction.type,
          existingTransaction.amount,
        );

        if ("error" in applied) {
          throw new Error(applied.error);
        }

        await tx.escrowAccount.update({
          where: { id: existingTransaction.escrowAccountId },
          data: {
            balance: applied.balance,
            lockedBalance: applied.lockedBalance,
          },
        });

        if (
          existingTransaction.milestoneId &&
          (existingTransaction.type === "release" ||
            existingTransaction.type === "auto_payment")
        ) {
          await tx.milestone.update({
            where: { id: existingTransaction.milestoneId },
            data: {
              status: "paid",
              paidAt: new Date(),
            },
          });
        }
      }

      if (
        existingTransaction.status === "completed" &&
        nextStatus !== "completed"
      ) {
        const reversed = reverseCompletedTransaction(
          existingTransaction.escrowAccount,
          existingTransaction.type,
          existingTransaction.amount,
        );

        if ("error" in reversed) {
          throw new Error(reversed.error);
        }

        await tx.escrowAccount.update({
          where: { id: existingTransaction.escrowAccountId },
          data: {
            balance: reversed.balance,
            lockedBalance: reversed.lockedBalance,
          },
        });
      }

      return tx.transaction.update({
        where: { id },
        data: {
          method: method === null ? null : method,
          status: nextStatus,
          reference,
          metadata:
            metadata !== undefined ? parseJsonField(metadata) : undefined,
          completedAt:
            nextStatus === "completed"
              ? existingTransaction.completedAt || new Date()
              : null,
        },
        include: {
          escrowAccount: true,
          milestone: true,
          actor: {
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
    });

    return res.json({
      message: "Transaction updated successfully",
      transaction,
    });
  } catch (error) {
    console.error("Update transaction error:", error);

    if (error instanceof Error && error.message.includes("balance")) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "completed") {
      return res.status(400).json({
        message:
          "Completed transactions cannot be deleted. Mark the transaction as reversed instead.",
      });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    return res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

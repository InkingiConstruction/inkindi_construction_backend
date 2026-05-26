import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../../config/db.js";

const getParamId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const canReadProjectEscrow = (
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

export const createEscrowAccount = async (req: Request, res: Response) => {
  try {
    const { projectId, currency, balance, lockedBalance } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const project = await prisma.project.findUnique({
      where: { id: String(projectId) },
      include: {
        escrowAccount: true,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.escrowAccount) {
      return res.status(409).json({
        message: "Project already has an escrow account",
        escrowAccount: project.escrowAccount,
      });
    }

    const escrowAccount = await prisma.escrowAccount.create({
      data: {
        projectId: project.id,
        currency: currency || project.currency,
        balance:
          balance !== undefined ? new Prisma.Decimal(balance) : undefined,
        lockedBalance:
          lockedBalance !== undefined
            ? new Prisma.Decimal(lockedBalance)
            : undefined,
      },
      include: {
        project: true,
        transactions: true,
      },
    });

    return res.status(201).json({
      message: "Escrow account created successfully",
      escrowAccount,
    });
  } catch (error) {
    console.error("Create escrow account error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getEscrowAccounts = async (req: Request, res: Response) => {
  try {
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;

    const escrowAccounts = await prisma.escrowAccount.findMany({
      where: {
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
      include: {
        project: true,
        transactions: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(escrowAccounts);
  } catch (error) {
    console.error("Get escrow accounts error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getEscrowAccountById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Escrow account ID is required" });
    }

    const escrowAccount = await prisma.escrowAccount.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
        transactions: {
          include: {
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
        },
      },
    });

    if (!escrowAccount) {
      return res.status(404).json({ message: "Escrow account not found" });
    }

    if (
      !canReadProjectEscrow(
        escrowAccount.project,
        req.user.id,
        req.user.role,
      )
    ) {
      return res.status(403).json({
        message: "You do not have access to this escrow account",
      });
    }

    return res.json(escrowAccount);
  } catch (error) {
    console.error("Get escrow account by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateEscrowAccount = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { currency, balance, lockedBalance } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Escrow account ID is required" });
    }

    const existingEscrowAccount = await prisma.escrowAccount.findUnique({
      where: { id },
    });

    if (!existingEscrowAccount) {
      return res.status(404).json({ message: "Escrow account not found" });
    }

    const escrowAccount = await prisma.escrowAccount.update({
      where: { id },
      data: {
        currency,
        balance:
          balance !== undefined ? new Prisma.Decimal(balance) : undefined,
        lockedBalance:
          lockedBalance !== undefined
            ? new Prisma.Decimal(lockedBalance)
            : undefined,
      },
      include: {
        project: true,
        transactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return res.json({
      message: "Escrow account updated successfully",
      escrowAccount,
    });
  } catch (error) {
    console.error("Update escrow account error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteEscrowAccount = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Escrow account ID is required" });
    }

    const escrowAccount = await prisma.escrowAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!escrowAccount) {
      return res.status(404).json({ message: "Escrow account not found" });
    }

    if (escrowAccount._count.transactions > 0) {
      return res.status(400).json({
        message: "Escrow account with transactions cannot be deleted",
      });
    }

    await prisma.escrowAccount.delete({
      where: { id },
    });

    return res.json({ message: "Escrow account deleted successfully" });
  } catch (error) {
    console.error("Delete escrow account error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

import { EscrowService } from "./escrow.service";

/**
 * @swagger
 * /api/v1/escrow-accounts/{id}/deposit-stripe:
 *   post:
 *     summary: Initialize a Stripe deposit for an escrow account
 *     tags: [Escrow]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: USD
 *     responses:
 *       200:
 *         description: Successfully created Stripe Payment Intent
 */
export const createStripeDeposit = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { amount, currency = "usd" } = req.body;

    if (!id || !amount) {
      return res.status(400).json({ message: "Account ID and amount are required" });
    }

    const intent = await EscrowService.createStripePaymentIntent(Number(amount), currency, id);
    return res.json({ message: "Stripe Payment Intent created", data: intent });
  } catch (error) {
    console.error("Stripe deposit error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @swagger
 * /api/v1/escrow-accounts/{id}/deposit-mtn:
 *   post:
 *     summary: Initialize an MTN Momo deposit for an escrow account
 *     tags: [Escrow]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully initiated MTN Momo prompt
 */
export const createMtnMomoDeposit = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { amount, phoneNumber } = req.body;

    if (!id || !amount || !phoneNumber) {
      return res.status(400).json({ message: "Account ID, amount, and phone number are required" });
    }

    const result = await EscrowService.initiateMtnMomoDeposit(Number(amount), phoneNumber, id, req.user.id);
    return res.json({ message: "MTN Momo prompt initiated", data: result });
  } catch (error) {
    console.error("MTN Momo deposit error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

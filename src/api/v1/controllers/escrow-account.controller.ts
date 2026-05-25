import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";

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

import { Request, Response } from "express";
import { Prisma, RfqStatus } from "@prisma/client";
import prisma from "../../../lib/prisma.js";

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

const isRfqStatus = (value: unknown): value is RfqStatus =>
  typeof value === "string" &&
  Object.values(RfqStatus).includes(value as RfqStatus);

const canReadProject = (
  project: {
    clientId: string;
    engineerId: string | null;
    projectMembers?: { userId: string; status: string }[];
  },
  userId: string,
  role: string,
) => {
  if (role === "admin" || role === "supplier") return true;
  if (project.clientId === userId) return true;
  if (project.engineerId === userId) return true;
  return Boolean(
    project.projectMembers?.some(
      (member) => member.userId === userId && member.status === "accepted",
    ),
  );
};

const canManageRfq = (
  rfq: { engineerId: string },
  userId: string,
  role: string,
) => role === "admin" || (role === "engineer" && rfq.engineerId === userId);

export const createRfq = async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      milestoneId,
      title,
      specs,
      quantity,
      unit,
      deadline,
      expiresAt,
      status,
    } = req.body;

    if (!projectId || !milestoneId || !title || !quantity || !unit || !deadline) {
      return res.status(400).json({
        message:
          "projectId, milestoneId, title, quantity, unit and deadline are required",
      });
    }

    if (status !== undefined && !isRfqStatus(status)) {
      return res.status(400).json({ message: "Invalid RFQ status" });
    }

    const milestone = await prisma.milestone.findFirst({
      where: {
        id: String(milestoneId),
        projectId: String(projectId),
      },
      include: {
        project: true,
      },
    });

    if (!milestone) {
      return res.status(404).json({
        message: "Milestone not found for this project",
      });
    }

    if (req.user.role !== "admin" && milestone.engineerId !== req.user.id) {
      return res.status(403).json({
        message: "Only the project engineer or admin can create RFQs",
      });
    }

    const rfq = await prisma.rfq.create({
      data: {
        projectId: milestone.projectId,
        milestoneId: milestone.id,
        engineerId: req.user.role === "admin" ? milestone.engineerId : req.user.id,
        title,
        specs: parseJsonField(specs) || {},
        quantity: new Prisma.Decimal(quantity),
        unit,
        deadline: new Date(deadline),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        status: status || "open",
      },
      include: {
        project: true,
        milestone: true,
        engineer: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
        quotes: true,
      },
    });

    return res.status(201).json({
      message: "RFQ created successfully",
      rfq,
    });
  } catch (error) {
    console.error("Create RFQ error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getRfqs = async (req: Request, res: Response) => {
  try {
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const milestoneId =
      typeof req.query.milestoneId === "string"
        ? req.query.milestoneId
        : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    if (status !== undefined && !isRfqStatus(status)) {
      return res.status(400).json({ message: "Invalid RFQ status" });
    }

    const rfqs = await prisma.rfq.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(milestoneId ? { milestoneId } : {}),
        ...(status ? { status } : {}),
        ...(req.user.role === "supplier"
          ? { status: status || "open" }
          : req.user.role === "admin"
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
        engineer: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
        quotes:
          req.user.role === "supplier"
            ? {
                where: { supplierId: req.user.id },
              }
            : true,
        purchaseOrder: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(rfqs);
  } catch (error) {
    console.error("Get RFQs error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getRfqById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "RFQ ID is required" });
    }

    const rfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
        milestone: true,
        engineer: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
        quotes:
          req.user.role === "supplier"
            ? {
                where: { supplierId: req.user.id },
              }
            : true,
        purchaseOrder: true,
      },
    });

    if (!rfq) {
      return res.status(404).json({ message: "RFQ not found" });
    }

    if (!canReadProject(rfq.project, req.user.id, req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(rfq);
  } catch (error) {
    console.error("Get RFQ by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateRfq = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { title, specs, quantity, unit, deadline, expiresAt, status } =
      req.body;

    if (!id) {
      return res.status(400).json({ message: "RFQ ID is required" });
    }

    if (status !== undefined && !isRfqStatus(status)) {
      return res.status(400).json({ message: "Invalid RFQ status" });
    }

    const existingRfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        purchaseOrder: true,
      },
    });

    if (!existingRfq) {
      return res.status(404).json({ message: "RFQ not found" });
    }

    if (!canManageRfq(existingRfq, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only the RFQ engineer or admin can update this RFQ",
      });
    }

    if (existingRfq.purchaseOrder && status !== "closed") {
      return res.status(400).json({
        message: "RFQ with purchase order can only be closed",
      });
    }

    const rfq = await prisma.rfq.update({
      where: { id },
      data: {
        title,
        specs: specs !== undefined ? parseJsonField(specs) : undefined,
        quantity:
          quantity !== undefined ? new Prisma.Decimal(quantity) : undefined,
        unit,
        deadline: deadline ? new Date(deadline) : undefined,
        expiresAt:
          expiresAt !== undefined
            ? expiresAt
              ? new Date(expiresAt)
              : null
            : undefined,
        status,
      },
      include: {
        project: true,
        milestone: true,
        quotes: true,
        purchaseOrder: true,
      },
    });

    return res.json({
      message: "RFQ updated successfully",
      rfq,
    });
  } catch (error) {
    console.error("Update RFQ error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteRfq = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "RFQ ID is required" });
    }

    const rfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        quotes: true,
        purchaseOrder: true,
      },
    });

    if (!rfq) {
      return res.status(404).json({ message: "RFQ not found" });
    }

    if (!canManageRfq(rfq, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only the RFQ engineer or admin can delete this RFQ",
      });
    }

    if (rfq.quotes.length > 0 || rfq.purchaseOrder) {
      return res.status(400).json({
        message: "RFQ with quotes or purchase order cannot be deleted",
      });
    }

    await prisma.rfq.delete({
      where: { id },
    });

    return res.json({ message: "RFQ deleted successfully" });
  } catch (error) {
    console.error("Delete RFQ error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";

const getParamId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const canReadProject = (
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

const canManageBoq = (
  milestone: { engineerId: string },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  return role === "engineer" && milestone.engineerId === userId;
};

const calculateTotalPrice = (quantity: unknown, unitPrice: unknown) =>
  Number(quantity) * Number(unitPrice);

const buildBoqUpdateData = (
  body: Record<string, unknown>,
  current: {
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
  },
) => {
  const data: Prisma.BoqItemUpdateInput = {};
  const quantity =
    body.quantity !== undefined
      ? Number(body.quantity)
      : Number(current.quantity);
  const unitPrice =
    body.unitPrice !== undefined
      ? Number(body.unitPrice)
      : Number(current.unitPrice);

  if (body.category !== undefined) data.category = String(body.category);
  if (body.name !== undefined) data.name = String(body.name);
  if (body.quantity !== undefined) data.quantity = String(body.quantity);
  if (body.unit !== undefined) data.unit = String(body.unit);
  if (body.unitPrice !== undefined) data.unitPrice = String(body.unitPrice);
  if (body.actualCost !== undefined) {
    data.actualCost = body.actualCost ? String(body.actualCost) : null;
  }
  if (body.notes !== undefined)
    data.notes = body.notes ? String(body.notes) : null;

  if (body.totalPrice !== undefined) {
    data.totalPrice = String(body.totalPrice);
  } else if (body.quantity !== undefined || body.unitPrice !== undefined) {
    data.totalPrice = String(calculateTotalPrice(quantity, unitPrice));
  }

  return data;
};

export const createBoqItem = async (req: Request, res: Response) => {
  try {
    const {
      milestoneId,
      category,
      name,
      quantity,
      unit,
      unitPrice,
      totalPrice,
      actualCost,
      notes,
    } = req.body;

    if (
      !milestoneId ||
      !category ||
      !name ||
      quantity === undefined ||
      !unit ||
      unitPrice === undefined
    ) {
      return res.status(400).json({
        message:
          "milestoneId, category, name, quantity, unit and unitPrice are required",
      });
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: String(milestoneId) },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
      },
    });

    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    if (!canManageBoq(milestone, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only the milestone engineer or admin can create BOQ items",
      });
    }

    const boqItem = await prisma.boqItem.create({
      data: {
        milestoneId: milestone.id,
        category: String(category),
        name: String(name),
        quantity: String(quantity),
        unit: String(unit),
        unitPrice: String(unitPrice),
        totalPrice: String(
          totalPrice ?? calculateTotalPrice(quantity, unitPrice),
        ),
        actualCost: actualCost !== undefined ? String(actualCost) : undefined,
        notes,
      },
      include: {
        milestone: {
          include: {
            project: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "BOQ item created successfully",
      boqItem,
    });
  } catch (error) {
    console.error("Create BOQ item error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getBoqItems = async (req: Request, res: Response) => {
  try {
    const milestoneId =
      typeof req.query.milestoneId === "string"
        ? req.query.milestoneId
        : undefined;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;

    const boqItems = await prisma.boqItem.findMany({
      where: {
        ...(milestoneId ? { milestoneId } : {}),
        ...(projectId ? { milestone: { projectId } } : {}),
        ...(req.user.role === "admin"
          ? {}
          : {
              milestone: {
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
              },
            }),
      },
      include: {
        milestone: {
          include: {
            project: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json(boqItems);
  } catch (error) {
    console.error("Get BOQ items error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getBoqItemById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "BOQ item ID is required" });
    }

    const boqItem = await prisma.boqItem.findUnique({
      where: { id },
      include: {
        milestone: {
          include: {
            project: {
              include: {
                projectMembers: true,
              },
            },
          },
        },
      },
    });

    if (!boqItem) {
      return res.status(404).json({ message: "BOQ item not found" });
    }

    if (
      !canReadProject(boqItem.milestone.project, req.user.id, req.user.role)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(boqItem);
  } catch (error) {
    console.error("Get BOQ item by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateBoqItem = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "BOQ item ID is required" });
    }

    const existingBoqItem = await prisma.boqItem.findUnique({
      where: { id },
      include: {
        milestone: true,
      },
    });

    if (!existingBoqItem) {
      return res.status(404).json({ message: "BOQ item not found" });
    }

    if (!canManageBoq(existingBoqItem.milestone, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only the milestone engineer or admin can update BOQ items",
      });
    }

    const boqItem = await prisma.boqItem.update({
      where: { id },
      data: buildBoqUpdateData(req.body, existingBoqItem),
      include: {
        milestone: {
          include: {
            project: true,
          },
        },
      },
    });

    return res.json({
      message: "BOQ item updated successfully",
      boqItem,
    });
  } catch (error) {
    console.error("Update BOQ item error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteBoqItem = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "BOQ item ID is required" });
    }

    const boqItem = await prisma.boqItem.findUnique({
      where: { id },
      include: {
        milestone: true,
      },
    });

    if (!boqItem) {
      return res.status(404).json({ message: "BOQ item not found" });
    }

    if (!canManageBoq(boqItem.milestone, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only the milestone engineer or admin can delete BOQ items",
      });
    }

    await prisma.boqItem.delete({
      where: { id },
    });

    return res.json({ message: "BOQ item deleted successfully" });
  } catch (error) {
    console.error("Delete BOQ item error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

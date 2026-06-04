import { Request, Response } from "express";
import { DisputeCategory, DisputeStatus, Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import { notifyProjectParticipants } from "../../../lib/notifications.js";

const getId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const parseJson = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value !== "string") return value as Prisma.InputJsonValue;

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return value;
  }
};

const isCategory = (value: unknown): value is DisputeCategory =>
  typeof value === "string" &&
  Object.values(DisputeCategory).includes(value as DisputeCategory);

const isStatus = (value: unknown): value is DisputeStatus =>
  typeof value === "string" &&
  Object.values(DisputeStatus).includes(value as DisputeStatus);

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

export const createDispute = async (req: Request, res: Response) => {
  try {
    const { projectId, milestoneId, category, description, amountInDispute } =
      req.body;

    if (!projectId || !category || !description || !amountInDispute) {
      return res.status(400).json({
        message:
          "projectId, category, description and amountInDispute are required",
      });
    }

    if (!isCategory(category)) {
      return res.status(400).json({ message: "Invalid dispute category" });
    }

    const project = await prisma.project.findUnique({
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
      const milestone = await prisma.milestone.findFirst({
        where: { id: String(milestoneId), projectId: project.id },
      });

      if (!milestone) {
        return res.status(400).json({
          message: "milestoneId must belong to the selected project",
        });
      }
    }

    const dispute = await prisma.dispute.create({
      data: {
        projectId: project.id,
        milestoneId: milestoneId ? String(milestoneId) : undefined,
        raisedById: req.user.id,
        category,
        description,
        amountInDispute: new Prisma.Decimal(amountInDispute),
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

    await notifyProjectParticipants({
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
  } catch (error) {
    console.error("Create dispute error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getDisputes = async (req: Request, res: Response) => {
  try {
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const milestoneId =
      typeof req.query.milestoneId === "string"
        ? req.query.milestoneId
        : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    if (status !== undefined && !isStatus(status)) {
      return res.status(400).json({ message: "Invalid dispute status" });
    }

    const disputes = await prisma.dispute.findMany({
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
  } catch (error) {
    console.error("Get disputes error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getDisputeById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Dispute ID is required" });
    }

    const dispute = await prisma.dispute.findUnique({
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
  } catch (error) {
    console.error("Get dispute by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateDispute = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const { status, resolution, resolvedBy, description, amountInDispute } =
      req.body;

    if (!id) {
      return res.status(400).json({ message: "Dispute ID is required" });
    }

    if (status !== undefined && !isStatus(status)) {
      return res.status(400).json({ message: "Invalid dispute status" });
    }

    const dispute = await prisma.dispute.update({
      where: { id },
      data: {
        status,
        resolution:
          resolution !== undefined ? parseJson(resolution) : undefined,
        resolvedBy:
          status && status !== "open" && status !== "under_review"
            ? resolvedBy || req.user.id
            : resolvedBy,
        resolvedAt:
          status && status !== "open" && status !== "under_review"
            ? new Date()
            : undefined,
        description,
        amountInDispute:
          amountInDispute !== undefined
            ? new Prisma.Decimal(amountInDispute)
            : undefined,
      },
      include: {
        project: true,
        milestone: true,
        evidence: true,
      },
    });

    if (status) {
      await notifyProjectParticipants({
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
  } catch (error) {
    console.error("Update dispute error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteDispute = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Dispute ID is required" });
    }

    await prisma.dispute.delete({ where: { id } });

    return res.json({ message: "Dispute deleted successfully" });
  } catch (error) {
    console.error("Delete dispute error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

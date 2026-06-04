import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";

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

export const createActivityLog = async (req: Request, res: Response) => {
  try {
    const { userId, action, metadata } = req.body;

    if (!action) {
      return res.status(400).json({ message: "action is required" });
    }

    const activityLog = await prisma.activityLog.create({
      data: {
        userId: req.user.role === "admin" && userId ? userId : req.user.id,
        action,
        metadata: parseJson(metadata),
        ipAddress: req.ip,
      },
      include: { user: true },
    });

    return res.status(201).json({
      message: "Activity log created successfully",
      activityLog,
    });
  } catch (error) {
    console.error("Create activity log error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const userId =
      typeof req.query.userId === "string" && req.user.role === "admin"
        ? req.query.userId
        : req.user.id;

    const activityLogs = await prisma.activityLog.findMany({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(activityLogs);
  } catch (error) {
    console.error("Get activity logs error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getActivityLogById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Activity log ID is required" });
    }

    const activityLog = await prisma.activityLog.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!activityLog) {
      return res.status(404).json({ message: "Activity log not found" });
    }

    if (req.user.role !== "admin" && activityLog.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(activityLog);
  } catch (error) {
    console.error("Get activity log by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateActivityLog = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const { action, metadata } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Activity log ID is required" });
    }

    const activityLog = await prisma.activityLog.update({
      where: { id },
      data: {
        action,
        metadata: metadata !== undefined ? parseJson(metadata) : undefined,
      },
      include: { user: true },
    });

    return res.json({
      message: "Activity log updated successfully",
      activityLog,
    });
  } catch (error) {
    console.error("Update activity log error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteActivityLog = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Activity log ID is required" });
    }

    await prisma.activityLog.delete({ where: { id } });

    return res.json({ message: "Activity log deleted successfully" });
  } catch (error) {
    console.error("Delete activity log error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

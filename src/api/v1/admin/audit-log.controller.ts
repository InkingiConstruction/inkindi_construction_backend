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

export const createAuditLog = async (req: Request, res: Response) => {
  try {
    const {
      actorId,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      result,
      projectId,
    } = req.body;

    if (!action || !entityType || !result) {
      return res.status(400).json({
        message: "action, entityType and result are required",
      });
    }

    const auditLog = await prisma.auditLog.create({
      data: {
        actorId: actorId || req.user.id,
        action,
        entityType,
        entityId,
        oldValues: parseJson(oldValues),
        newValues: parseJson(newValues),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        result,
        projectId,
      },
      include: { actor: true, project: true },
    });

    return res.status(201).json({
      message: "Audit log created successfully",
      auditLog,
    });
  } catch (error) {
    console.error("Create audit log error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const actorId =
      typeof req.query.actorId === "string" ? req.query.actorId : undefined;
    const entityType =
      typeof req.query.entityType === "string"
        ? req.query.entityType
        : undefined;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        ...(actorId ? { actorId } : {}),
        ...(entityType ? { entityType } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: { actor: true, project: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(auditLogs);
  } catch (error) {
    console.error("Get audit logs error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAuditLogById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Audit log ID is required" });
    }

    const auditLog = await prisma.auditLog.findUnique({
      where: { id },
      include: { actor: true, project: true },
    });

    if (!auditLog) {
      return res.status(404).json({ message: "Audit log not found" });
    }

    return res.json(auditLog);
  } catch (error) {
    console.error("Get audit log by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateAuditLog = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const { result, oldValues, newValues } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Audit log ID is required" });
    }

    const auditLog = await prisma.auditLog.update({
      where: { id },
      data: {
        result,
        oldValues: oldValues !== undefined ? parseJson(oldValues) : undefined,
        newValues: newValues !== undefined ? parseJson(newValues) : undefined,
      },
      include: { actor: true, project: true },
    });

    return res.json({
      message: "Audit log updated successfully",
      auditLog,
    });
  } catch (error) {
    console.error("Update audit log error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteAuditLog = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Audit log ID is required" });
    }

    await prisma.auditLog.delete({ where: { id } });

    return res.json({ message: "Audit log deleted successfully" });
  } catch (error) {
    console.error("Delete audit log error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

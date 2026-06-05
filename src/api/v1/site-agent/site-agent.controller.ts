import { Request, Response } from "express";
import prisma from "../../../config/db.js";

const parseJson = (value: unknown, fallback: unknown = []) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

const ensureProjectAccess = async (projectId: string, userId: string, role?: string | null) => {
  if (role === "admin") return true;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { clientId: userId },
        { engineerId: userId },
        {
          projectMembers: {
            some: {
              userId,
              status: "accepted",
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(project);
};

export const listDailyReports = async (req: Request, res: Response) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const reports = await prisma.siteDailyReport.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(req.user.role === "site_agent" ? { siteAgentId: req.user.id } : {}),
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        siteAgent: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json(reports);
  } catch (error) {
    console.error("List site daily reports error:", error);
    return res.status(500).json({ message: "Failed to load daily reports" });
  }
};

export const createDailyReport = async (req: Request, res: Response) => {
  try {
    const projectId = String(req.body.projectId || "");
    const weather = String(req.body.weather || "").trim();
    const workforceCount = Number(req.body.workforceCount);
    const taskProgress = String(req.body.taskProgress || "").trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : undefined;

    if (!projectId || !weather || !Number.isFinite(workforceCount) || workforceCount < 0 || !taskProgress) {
      return res.status(400).json({ message: "projectId, weather, workforceCount and taskProgress are required" });
    }

    const hasAccess = await ensureProjectAccess(projectId, req.user.id, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ message: "You are not assigned to this project" });
    }

    const report = await prisma.siteDailyReport.create({
      data: {
        projectId,
        siteAgentId: req.user.id,
        weather,
        workforceCount,
        taskProgress,
        notes,
        evidence: parseJson(req.body.evidence),
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
      },
    });

    return res.status(201).json(report);
  } catch (error) {
    console.error("Create site daily report error:", error);
    return res.status(500).json({ message: "Failed to create daily report" });
  }
};

export const listInventoryLogs = async (req: Request, res: Response) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const logs = await prisma.siteInventoryLog.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(req.user.role === "site_agent" ? { siteAgentId: req.user.id } : {}),
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        siteAgent: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json(logs);
  } catch (error) {
    console.error("List site inventory logs error:", error);
    return res.status(500).json({ message: "Failed to load inventory logs" });
  }
};

export const createInventoryLog = async (req: Request, res: Response) => {
  try {
    const projectId = String(req.body.projectId || "");
    const material = String(req.body.material || "").trim();
    const quantity = Number(req.body.quantity);
    const unit = req.body.unit ? String(req.body.unit).trim() : undefined;
    const direction = req.body.direction ? String(req.body.direction).trim() : "consumed";
    const notes = req.body.notes ? String(req.body.notes).trim() : undefined;

    if (!projectId || !material || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ message: "projectId, material and positive quantity are required" });
    }

    const hasAccess = await ensureProjectAccess(projectId, req.user.id, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ message: "You are not assigned to this project" });
    }

    const log = await prisma.siteInventoryLog.create({
      data: {
        projectId,
        siteAgentId: req.user.id,
        material,
        unit,
        quantity,
        direction,
        notes,
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
      },
    });

    return res.status(201).json(log);
  } catch (error) {
    console.error("Create site inventory log error:", error);
    return res.status(500).json({ message: "Failed to create inventory log" });
  }
};

export const listDeliveryVerifications = async (req: Request, res: Response) => {
  try {
    const records = await prisma.deliveryVerification.findMany({
      where: {
        ...(req.user.role === "site_agent" ? { siteAgentId: req.user.id } : {}),
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        delivery: { select: { id: true, status: true, purchaseOrderId: true } },
        siteAgent: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json(records);
  } catch (error) {
    console.error("List delivery verifications error:", error);
    return res.status(500).json({ message: "Failed to load delivery verifications" });
  }
};

export const createDeliveryVerification = async (req: Request, res: Response) => {
  try {
    const projectId = String(req.body.projectId || "");
    const deliveryId = req.body.deliveryId ? String(req.body.deliveryId) : undefined;
    const deliveryCode = String(req.body.deliveryCode || "").trim();
    const pin = String(req.body.pin || "").trim();
    const remarks = req.body.remarks ? String(req.body.remarks).trim() : undefined;

    if (!projectId || !deliveryCode || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: "projectId, deliveryCode and 6-digit PIN are required" });
    }

    const hasAccess = await ensureProjectAccess(projectId, req.user.id, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ message: "You are not assigned to this project" });
    }

    const verification = await prisma.deliveryVerification.create({
      data: {
        projectId,
        deliveryId,
        siteAgentId: req.user.id,
        deliveryCode,
        pin,
        remarks,
        receiptPhotos: parseJson(req.body.receiptPhotos),
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        delivery: { select: { id: true, status: true, purchaseOrderId: true } },
      },
    });

    return res.status(201).json(verification);
  } catch (error) {
    console.error("Create delivery verification error:", error);
    return res.status(500).json({ message: "Failed to verify delivery" });
  }
};

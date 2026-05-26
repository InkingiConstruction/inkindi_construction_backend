import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../../../lib/prisma.js";

const getId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

export const createSession = async (req: Request, res: Response) => {
  try {
    const { id, token, userId, expiresAt, ipAddress, userAgent, impersonatedBy } =
      req.body;

    if (!userId || !expiresAt) {
      return res.status(400).json({ message: "userId and expiresAt are required" });
    }

    const session = await prisma.session.create({
      data: {
        id: id || crypto.randomUUID(),
        token: token || crypto.randomBytes(32).toString("hex"),
        userId,
        expiresAt: new Date(expiresAt),
        ipAddress,
        userAgent,
        impersonatedBy,
      },
      include: { user: true },
    });

    return res.status(201).json({
      message: "Session created successfully",
      session,
    });
  } catch (error) {
    console.error("Create session error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;

    const sessions = await prisma.session.findMany({
      where: { ...(userId ? { userId } : {}) },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(sessions);
  } catch (error) {
    console.error("Get sessions error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getSessionById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    return res.json(session);
  } catch (error) {
    console.error("Get session by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateSession = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const { expiresAt, ipAddress, userAgent, impersonatedBy } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    const session = await prisma.session.update({
      where: { id },
      data: {
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        ipAddress,
        userAgent,
        impersonatedBy,
      },
      include: { user: true },
    });

    return res.json({
      message: "Session updated successfully",
      session,
    });
  } catch (error) {
    console.error("Update session error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    await prisma.session.delete({ where: { id } });

    return res.json({ message: "Session deleted successfully" });
  } catch (error) {
    console.error("Delete session error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

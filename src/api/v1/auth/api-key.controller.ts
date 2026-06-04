import { Request, Response } from "express";
import crypto from "crypto";
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

const hashKey = (key: string) =>
  crypto.createHash("sha256").update(key).digest("hex");

const sanitizeApiKey = <T extends { keyHash: string }>(apiKey: T) => {
  const { keyHash, ...safeApiKey } = apiKey;
  return safeApiKey;
};

export const createApiKey = async (req: Request, res: Response) => {
  try {
    const { name, permissions, expiresAt, userId } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const rawKey = `ik_${crypto.randomBytes(32).toString("hex")}`;
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.user.role === "admin" && userId ? userId : req.user.id,
        name,
        keyHash: hashKey(rawKey),
        prefix: rawKey.slice(0, 12),
        permissions: parseJson(permissions) || [],
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
      include: { user: true },
    });

    return res.status(201).json({
      message: "API key created successfully",
      apiKey: sanitizeApiKey(apiKey),
      key: rawKey,
    });
  } catch (error) {
    console.error("Create API key error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getApiKeys = async (req: Request, res: Response) => {
  try {
    const userId =
      typeof req.query.userId === "string" && req.user.role === "admin"
        ? req.query.userId
        : req.user.id;

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(apiKeys.map(sanitizeApiKey));
  } catch (error) {
    console.error("Get API keys error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getApiKeyById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "API key ID is required" });
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!apiKey) {
      return res.status(404).json({ message: "API key not found" });
    }

    if (req.user.role !== "admin" && apiKey.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(sanitizeApiKey(apiKey));
  } catch (error) {
    console.error("Get API key by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateApiKey = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const { name, permissions, expiresAt, revokedAt } = req.body;

    if (!id) {
      return res.status(400).json({ message: "API key ID is required" });
    }

    const existing = await prisma.apiKey.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ message: "API key not found" });
    }

    if (req.user.role !== "admin" && existing.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        name,
        permissions:
          permissions !== undefined ? parseJson(permissions) : undefined,
        expiresAt:
          expiresAt !== undefined
            ? expiresAt
              ? new Date(expiresAt)
              : null
            : undefined,
        revokedAt:
          revokedAt !== undefined
            ? revokedAt
              ? new Date(revokedAt)
              : null
            : undefined,
      },
      include: { user: true },
    });

    return res.json({
      message: "API key updated successfully",
      apiKey: sanitizeApiKey(apiKey),
    });
  } catch (error) {
    console.error("Update API key error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteApiKey = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "API key ID is required" });
    }

    const existing = await prisma.apiKey.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ message: "API key not found" });
    }

    if (req.user.role !== "admin" && existing.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.apiKey.delete({ where: { id } });

    return res.json({ message: "API key deleted successfully" });
  } catch (error) {
    console.error("Delete API key error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

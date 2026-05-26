import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";

const getId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const parseJson = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return value as Prisma.InputJsonValue;

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return value;
  }
};

export const createSystemSetting = async (req: Request, res: Response) => {
  try {
    const { key, value, description } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ message: "key and value are required" });
    }

    const systemSetting = await prisma.systemSetting.create({
      data: {
        key,
        value: parseJson(value) ?? {},
        description,
        updatedBy: req.user.id,
      },
    });

    return res.status(201).json({
      message: "System setting created successfully",
      systemSetting,
    });
  } catch (error) {
    console.error("Create system setting error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getSystemSettings = async (_req: Request, res: Response) => {
  try {
    const systemSettings = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });

    return res.json(systemSettings);
  } catch (error) {
    console.error("Get system settings error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getSystemSettingById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "System setting ID is required" });
    }

    const systemSetting = await prisma.systemSetting.findUnique({
      where: { id },
    });

    if (!systemSetting) {
      return res.status(404).json({ message: "System setting not found" });
    }

    return res.json(systemSetting);
  } catch (error) {
    console.error("Get system setting by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateSystemSetting = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const { key, value, description } = req.body;

    if (!id) {
      return res.status(400).json({ message: "System setting ID is required" });
    }

    const systemSetting = await prisma.systemSetting.update({
      where: { id },
      data: {
        key,
        value: value !== undefined ? parseJson(value) : undefined,
        description,
        updatedBy: req.user.id,
      },
    });

    return res.json({
      message: "System setting updated successfully",
      systemSetting,
    });
  } catch (error) {
    console.error("Update system setting error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteSystemSetting = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "System setting ID is required" });
    }

    await prisma.systemSetting.delete({ where: { id } });

    return res.json({ message: "System setting deleted successfully" });
  } catch (error) {
    console.error("Delete system setting error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

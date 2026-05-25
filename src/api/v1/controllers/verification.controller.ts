import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../../../lib/prisma.js";

const getId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

export const createVerification = async (req: Request, res: Response) => {
  try {
    const { id, identifier, value, expiresAt } = req.body;

    if (!identifier || !value || !expiresAt) {
      return res.status(400).json({
        message: "identifier, value and expiresAt are required",
      });
    }

    const verification = await prisma.verification.create({
      data: {
        id: id || crypto.randomUUID(),
        identifier,
        value,
        expiresAt: new Date(expiresAt),
      },
    });

    return res.status(201).json({
      message: "Verification created successfully",
      verification,
    });
  } catch (error) {
    console.error("Create verification error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getVerifications = async (req: Request, res: Response) => {
  try {
    const identifier =
      typeof req.query.identifier === "string"
        ? req.query.identifier
        : undefined;

    const verifications = await prisma.verification.findMany({
      where: { ...(identifier ? { identifier } : {}) },
      orderBy: { createdAt: "desc" },
    });

    return res.json(verifications);
  } catch (error) {
    console.error("Get verifications error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getVerificationById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Verification ID is required" });
    }

    const verification = await prisma.verification.findUnique({
      where: { id },
    });

    if (!verification) {
      return res.status(404).json({ message: "Verification not found" });
    }

    return res.json(verification);
  } catch (error) {
    console.error("Get verification by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateVerification = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const { identifier, value, expiresAt } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Verification ID is required" });
    }

    const verification = await prisma.verification.update({
      where: { id },
      data: {
        identifier,
        value,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });

    return res.json({
      message: "Verification updated successfully",
      verification,
    });
  } catch (error) {
    console.error("Update verification error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteVerification = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Verification ID is required" });
    }

    await prisma.verification.delete({ where: { id } });

    return res.json({ message: "Verification deleted successfully" });
  } catch (error) {
    console.error("Delete verification error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

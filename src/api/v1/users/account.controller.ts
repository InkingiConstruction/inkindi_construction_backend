import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../../../lib/prisma.js";

const getId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const sanitizeAccount = <T extends { password?: string | null }>(account: T) => {
  const { password, ...safeAccount } = account;
  return safeAccount;
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const {
      id,
      accountId,
      providerId,
      userId,
      accessToken,
      refreshToken,
      idToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      scope,
      password,
    } = req.body;

    if (!accountId || !providerId || !userId) {
      return res.status(400).json({
        message: "accountId, providerId and userId are required",
      });
    }

    const account = await prisma.account.create({
      data: {
        id: id || crypto.randomUUID(),
        accountId,
        providerId,
        userId,
        accessToken,
        refreshToken,
        idToken,
        accessTokenExpiresAt: accessTokenExpiresAt
          ? new Date(accessTokenExpiresAt)
          : undefined,
        refreshTokenExpiresAt: refreshTokenExpiresAt
          ? new Date(refreshTokenExpiresAt)
          : undefined,
        scope,
        password,
      },
      include: { user: true },
    });

    return res.status(201).json({
      message: "Account created successfully",
      account: sanitizeAccount(account),
    });
  } catch (error) {
    console.error("Create account error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;

    const accounts = await prisma.account.findMany({
      where: { ...(userId ? { userId } : {}) },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(accounts.map(sanitizeAccount));
  } catch (error) {
    console.error("Get accounts error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAccountById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Account ID is required" });
    }

    const account = await prisma.account.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    return res.json(sanitizeAccount(account));
  } catch (error) {
    console.error("Get account by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const {
      accessToken,
      refreshToken,
      idToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      scope,
      password,
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Account ID is required" });
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        accessToken,
        refreshToken,
        idToken,
        accessTokenExpiresAt:
          accessTokenExpiresAt !== undefined
            ? accessTokenExpiresAt
              ? new Date(accessTokenExpiresAt)
              : null
            : undefined,
        refreshTokenExpiresAt:
          refreshTokenExpiresAt !== undefined
            ? refreshTokenExpiresAt
              ? new Date(refreshTokenExpiresAt)
              : null
            : undefined,
        scope,
        password,
      },
      include: { user: true },
    });

    return res.json({
      message: "Account updated successfully",
      account: sanitizeAccount(account),
    });
  } catch (error) {
    console.error("Update account error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Account ID is required" });
    }

    await prisma.account.delete({ where: { id } });

    return res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

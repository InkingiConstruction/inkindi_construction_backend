import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { WalletService } from "./escrow.service";
import prisma from "../../../config/db";

const getParamId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

/**
 * GET /api/v1/wallet
 * Get current user's wallet summary
 */
export const getMyWallet = async (req: Request, res: Response) => {
  try {
    const wallet = await WalletService.ensureWallet(req.user.id);
    const summary = await WalletService.getWallet(req.user.id);
    return res.json(summary);
  } catch (error) {
    console.error("Get wallet error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * GET /api/v1/wallet/transactions?page=1&limit=20&type=funding
 */
export const getMyWalletHistory = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const type = req.query.type as any | undefined;
    const result = await WalletService.getWalletHistory(req.user.id, { page, limit, type });
    return res.json(result);
  } catch (error) {
    console.error("Get wallet history error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /api/v1/wallet/fund
 * Initiate a funding request (simulated Stripe / Momo)
 * Body: { amount, method, phoneNumber? }
 */
export const initiateFunding = async (req: Request, res: Response) => {
  try {
    const amount = Number(req.body.amount);
    const method = req.body.method as "stripe" | "mtn_momo" | "airtel_money" | "bank_transfer";
    const phoneNumber = req.body.phoneNumber;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }
    if (!["stripe", "mtn_momo", "airtel_money", "bank_transfer"].includes(method)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }
    if ((method === "mtn_momo" || method === "airtel_money") && !phoneNumber) {
      return res.status(400).json({ message: "Phone number required for mobile money" });
    }

    const funding = await WalletService.createFundingRequest({
      userId: req.user.id,
      amount,
      method,
      phoneNumber,
      metadata: { initiatedBy: req.user.id, ip: req.ip },
    });

    return res.status(201).json({
      message: "Funding request created. Confirm to complete.",
      fundingRequest: funding,
    });
  } catch (error) {
    console.error("Initiate funding error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /api/v1/wallet/fund/:fundingId/confirm  [TEST/SIMULATION]
 * Simulates provider webhook callback — only for development/testing.
 */
export const confirmFundingTest = async (req: Request, res: Response) => {
  try {
    const fundingId = getParamId(req.params.fundingId);
    if (!fundingId) return res.status(400).json({ message: "Funding ID required" });

    const result = await WalletService.simulateFundingSuccess(fundingId);
    return res.json({
      message: "Funding completed (simulated)",
      data: result,
    });
  } catch (error: any) {
    console.error("Confirm funding error:", error);
    return res.status(400).json({ message: error.message ?? "Funding confirmation failed" });
  }
};

/**
 * POST /api/v1/wallet/transfer-to-vault
 * Body: { escrowAccountId, amount, description? }
 */
export const transferToVault = async (req: Request, res: Response) => {
  try {
    const { escrowAccountId, amount, description } = req.body;
    if (!escrowAccountId || !Number.isFinite(Number(amount))) {
      return res.status(400).json({ message: "escrowAccountId and amount required" });
    }
    const result = await WalletService.transferToVault({
      userId: req.user.id,
      escrowAccountId,
      amount: Number(amount),
      description,
    });
    return res.json({ message: "Transfer to vault successful", data: result });
  } catch (error: any) {
    console.error("Transfer to vault error:", error);
    return res.status(400).json({ message: error.message ?? "Transfer failed" });
  }
};

/**
 * GET /api/v1/wallet/project-vaults
 * List all project vaults the user has funded
 */
export const listMyProjectVaults = async (req: Request, res: Response) => {
  try {
    const vaults = await WalletService.listUserProjectVaults(req.user.id);
    return res.json({ items: vaults });
  } catch (error) {
    console.error("List vaults error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * GET /api/v1/wallet/project-vaults/:escrowAccountId
 * Details for a specific project vault (deposits, balance, history)
 */
export const getProjectVaultDetails = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.escrowAccountId);
    if (!id) return res.status(400).json({ message: "escrowAccountId required" });
    const details = await WalletService.getProjectVaultBalance(req.user.id, id);
    if (!details) return res.status(404).json({ message: "Vault not found" });
    return res.json(details);
  } catch (error) {
    console.error("Get vault details error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

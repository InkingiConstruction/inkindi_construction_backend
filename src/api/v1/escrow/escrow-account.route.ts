/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : escrow-account.route.ts
 * WHAT THIS FILE DOES : Declares all HTTP endpoints for Escrow Account resource
 * HOW IT DOES IT      : Maps routes to controller actions with RBAC middleware guards
 * DATA SOURCE         : Express HTTP Requests
 * DATA DESTINATION    : Escrow Account Controller
 * PRINCIPLE APPLIED   : SOLID (Decoupled route declarations)
 * ============================================================================
 */

import { Router } from "express";
import express from "express";
import {
  createEscrowAccount,
  deleteEscrowAccount,
  getEscrowAccountById,
  getEscrowAccounts,
  updateEscrowAccount,
  createStripeDeposit,
  createMtnMomoDeposit,
} from "./escrow-account.controller";
import { handleStripeWebhook } from "./escrow.webhook.js";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

/**
 * 🧱 CODE BLOCK: Escrow Routes Map
 * WHAT IT IS DOING: Registers CRUD + deposit + webhook routes for escrow accounts
 * WHY IT IS HERE  : Single place to control Escrow HTTP access patterns
 * PRINCIPLE       : SOLID, DRY
 */

// -- CRUD --
router.post("/", requiredAuth, requireRole("admin"), createEscrowAccount);
router.get("/", requiredAuth, requireRole("client", "engineer", "admin"), getEscrowAccounts);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "admin"), getEscrowAccountById);
router.put("/:id", requiredAuth, requireRole("admin"), updateEscrowAccount);
router.delete("/:id", requiredAuth, requireRole("admin"), deleteEscrowAccount);

// -- Deposits --
router.post("/:id/deposit-stripe", requiredAuth, requireRole("client"), createStripeDeposit);
router.post("/:id/deposit-mtn", requiredAuth, requireRole("client"), createMtnMomoDeposit);

// -- Stripe Webhook (raw body required - no auth middleware) --
router.post("/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);

export default router;

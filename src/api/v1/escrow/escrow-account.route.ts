/**
 * ============================================================================
 * 📄 FILE: escrow-account.routes.ts  (a.k.a. /api/v1/wallet)
 * ============================================================================
 *
 * 🏗️  INKINGIPRO — ESCROW / WALLET ROUTING
 * ----------------------------------------------------------------------------
 * This router is the HTTP surface for everything the **Client** does with
 * money before it lands in a project vault. The flow has been upgraded from
 * "deposit directly to escrow" to a **3-layer architecture**:
 *
 *   LAYER 1 — Payment Providers (outside the system)
 *             Stripe • MTN Momo • Airtel Money • Bank Transfer
 *                         │
 *                         │  POST /fund
 *                         │  POST /fund/:fundingId/confirm   (webhook / test)
 *                         ▼
 *   LAYER 2 — USER WALLET  ◀── Layer 2 in wallet.service.ts
 *             One wallet per user. Holds the spendable balance.
 *                         │
 *                         │  POST /transfer-to-vault
 *                         ▼
 *   LAYER 3 — ESCROW ACCOUNTS (Project Vaults)
 *             One per project. Backs milestones and engineer payouts.
 *
 * ----------------------------------------------------------------------------
 * ROUTE MAP
 * ----------------------------------------------------------------------------
 *   GET  /                          → getMyWallet           (snapshot)
 *   GET  /transactions              → getMyWalletHistory    (paginated)
 *   POST /fund                      → initiateFunding       (create req.)
 *   POST /fund/:fundingId/confirm   → confirmFundingTest    (dev simulator)
 *   POST /transfer-to-vault         → transferToVault       (Layer 2 → 3)
 *   GET  /project-vaults            → listMyProjectVaults
 *   GET  /project-vaults/:id        → getProjectVaultDetails
 *
 * ----------------------------------------------------------------------------
 * SECURITY MODEL
 * ----------------------------------------------------------------------------
 *   • `requiredAuth`          — every route requires a valid session.
 *   • `requireRole("client")`  — only clients may fund/transfer.
 *   • `requireRole("client", "admin")`
 *                             — confirmFunding is also reachable by admins
 *                               for manual reconciliation of failed
 *                               provider callbacks.
 *
 * The router itself is **stateless** — all business rules live in
 * `wallet.service.ts`. Routes only translate HTTP ↔ service calls.
 * ============================================================================
 */

import { Router } from "express";
import {
  getMyWallet,
  getMyWalletHistory,
  initiateFunding,
  confirmFundingTest,
  transferToVault,
  listMyProjectVaults,
  getProjectVaultDetails,
} from "./escrow-account.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(requiredAuth);

router.get("/", getMyWallet);
router.get("/transactions", getMyWalletHistory);
router.post("/fund", requireRole("client"), initiateFunding);
router.post("/fund/:fundingId/confirm", requireRole("client", "admin"), confirmFundingTest);
router.post("/transfer-to-vault", requireRole("client"), transferToVault);
router.get("/project-vaults", listMyProjectVaults);
router.get("/project-vaults/:escrowAccountId", getProjectVaultDetails);

export default router;

"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const escrow_account_controller_1 = require("./escrow-account.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requiredAuth);
router.get("/", escrow_account_controller_1.getMyWallet);
router.get("/transactions", escrow_account_controller_1.getMyWalletHistory);
router.post("/fund", (0, role_middleware_1.requireRole)("client"), escrow_account_controller_1.initiateFunding);
router.post("/fund/:fundingId/confirm", (0, role_middleware_1.requireRole)("client", "admin"), escrow_account_controller_1.confirmFundingTest);
router.post("/transfer-to-vault", (0, role_middleware_1.requireRole)("client"), escrow_account_controller_1.transferToVault);
router.get("/project-vaults", escrow_account_controller_1.listMyProjectVaults);
router.get("/project-vaults/:escrowAccountId", escrow_account_controller_1.getProjectVaultDetails);
router.delete("/project-vaults/:escrowAccountId", (0, role_middleware_1.requireRole)("client"), escrow_account_controller_1.deleteProjectVault);
exports.default = router;

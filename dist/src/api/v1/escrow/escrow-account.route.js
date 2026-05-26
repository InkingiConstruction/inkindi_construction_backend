"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const escrow_account_controller_1 = require("./escrow-account.controller");
const escrow_webhook_js_1 = require("./escrow.webhook.js");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
/**
 * 🧱 CODE BLOCK: Escrow Routes Map
 * WHAT IT IS DOING: Registers CRUD + deposit + webhook routes for escrow accounts
 * WHY IT IS HERE  : Single place to control Escrow HTTP access patterns
 * PRINCIPLE       : SOLID, DRY
 */
// -- CRUD --
router.post("/", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("admin"), escrow_account_controller_1.createEscrowAccount);
router.get("/", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "admin"), escrow_account_controller_1.getEscrowAccounts);
router.get("/:id", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "admin"), escrow_account_controller_1.getEscrowAccountById);
router.put("/:id", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("admin"), escrow_account_controller_1.updateEscrowAccount);
router.delete("/:id", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("admin"), escrow_account_controller_1.deleteEscrowAccount);
// -- Deposits --
router.post("/:id/deposit-stripe", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client"), escrow_account_controller_1.createStripeDeposit);
router.post("/:id/deposit-mtn", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client"), escrow_account_controller_1.createMtnMomoDeposit);
// -- Stripe Webhook (raw body required - no auth middleware) --
router.post("/webhooks/stripe", express_2.default.raw({ type: "application/json" }), escrow_webhook_js_1.handleStripeWebhook);
exports.default = router;

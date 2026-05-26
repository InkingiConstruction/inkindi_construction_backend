"use strict";
/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : stripe.ts
 * WHAT THIS FILE DOES : Initializes and exports the Stripe SDK client instance
 * HOW IT DOES IT      : Reads the Stripe Secret Key from environment variables and sets API version
 * DATA SOURCE         : .env (STRIPE_SECRET_KEY)
 * DATA DESTINATION    : Stripe API
 * PRINCIPLE APPLIED   : SOLID (Single Responsibility - Stripe config only)
 * ============================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
/**
 * 🧱 CODE BLOCK: Stripe Initialization
 * WHAT IT IS DOING: Instantiates Stripe with the provided secret key
 * WHY IT IS HERE  : Centralizes the Stripe client so we don't initialize it in every controller
 * PRINCIPLE       : DRY
 */
exports.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia", // Stripe API v2 - latest stable
});
exports.default = exports.stripe;

"use strict";
/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : escrow.service.ts
 * WHAT THIS FILE DOES : Handles payment intent creation for Stripe and MTN Momo
 * HOW IT DOES IT      : Interfaces with Stripe SDK and MTN Momo Sandbox API
 * DATA SOURCE         : Controller parameters (amount, currency, project)
 * DATA DESTINATION    : Stripe API / MTN API / Prisma DB
 * PRINCIPLE APPLIED   : SOLID (Business logic separated from HTTP)
 * ============================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowService = void 0;
const stripe_1 = require("../../../integrations/stripe");
const db_js_1 = __importDefault(require("../../../config/db.js"));
const crypto_1 = __importDefault(require("crypto"));
class EscrowService {
    /**
     * ============================================================================
     * 🔧 FUNCTION: createStripePaymentIntent
     * ============================================================================
     * WHAT IT DOES: Generates a Stripe PaymentIntent for escrow deposit
     * PARAMETERS:
     *   - amount (number) : Amount to deposit
     *   - currency (string) : Currency code (e.g., usd, rwf)
     *   - escrowAccountId (string) : ID of the escrow account
     * RETURNS: Promise<{ clientSecret: string, paymentIntentId: string }>
     * PRINCIPLE: KISS, SOLID
     * ============================================================================
     */
    static async createStripePaymentIntent(amount, currency, escrowAccountId) {
        const paymentIntent = await stripe_1.stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: currency.toLowerCase(),
            metadata: {
                escrowAccountId,
                type: "deposit",
            },
        });
        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        };
    }
    /**
     * ============================================================================
     * 🔧 FUNCTION: initiateMtnMomoDeposit
     * ============================================================================
     * WHAT IT DOES: Initiates a deposit request via MTN Mobile Money Sandbox
     * PARAMETERS:
     *   - amount (number) : Amount to deposit
     *   - phoneNumber (string) : Client's MTN phone number
     *   - escrowAccountId (string) : ID of the escrow account
     * RETURNS: Promise<{ referenceId: string, status: string }>
     * PRINCIPLE: KISS, SOLID
     * ============================================================================
     */
    static async initiateMtnMomoDeposit(amount, phoneNumber, escrowAccountId, userId) {
        // Note: In a real implementation, you would use the MTN Momo API here.
        // For sandbox, we simulate the request.
        const referenceId = crypto_1.default.randomUUID();
        // Log the transaction in pending state
        await db_js_1.default.transaction.create({
            data: {
                escrowAccountId,
                actorId: userId,
                type: "deposit",
                method: "mtn_momo",
                amount: amount,
                status: "pending",
                reference: referenceId,
                metadata: { provider: "mtn_momo", phoneNumber },
            }
        });
        return {
            referenceId,
            status: "pending",
            message: "Please check your phone to approve the MTN Momo prompt.",
        };
    }
}
exports.EscrowService = EscrowService;

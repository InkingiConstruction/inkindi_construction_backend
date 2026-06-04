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
const ZERO_DECIMAL_CURRENCIES = new Set([
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
]);
const toStripeAmount = (amount, currency) => {
    const normalizedCurrency = currency.toLowerCase();
    return ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)
        ? Math.round(amount)
        : Math.round(amount * 100);
};
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
    static async createStripePaymentIntent(amount, currency, escrowAccountId, actorId) {
        const normalizedCurrency = currency.toLowerCase();
        const paymentIntent = await stripe_1.stripe.paymentIntents.create({
            amount: toStripeAmount(amount, normalizedCurrency),
            currency: normalizedCurrency,
            metadata: {
                escrowAccountId,
                actorId,
                amount: String(amount),
                currency: normalizedCurrency,
                type: "deposit",
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        await db_js_1.default.transaction.create({
            data: {
                escrowAccountId,
                actorId,
                type: "deposit",
                method: "bank_transfer",
                amount,
                status: "pending",
                reference: paymentIntent.id,
                metadata: {
                    provider: "stripe",
                    paymentIntentId: paymentIntent.id,
                },
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

"use strict";
/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : escrow.webhook.ts
 * WHAT THIS FILE DOES : Listens for confirmed Stripe payment events to finalize deposits
 * HOW IT DOES IT      : Verifies Stripe webhook signature, reads event type, and updates DB
 * DATA SOURCE         : Stripe Webhook POST event (raw body)
 * DATA DESTINATION    : Prisma DB (EscrowAccount balance + Transaction status)
 * PRINCIPLE APPLIED   : SOLID (Isolated webhook concern)
 * ============================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStripeWebhook = void 0;
const stripe_1 = __importDefault(require("../../../integrations/stripe"));
const db_js_1 = __importDefault(require("../../../config/db.js"));
const logger_middleware_1 = require("../../../common/middleware/logger.middleware");
const notifications_js_1 = require("../../../lib/notifications.js");
/**
 * ============================================================================
 * 🔧 FUNCTION: handleStripeWebhook
 * ============================================================================
 * WHAT IT DOES: Receives Stripe events and updates the escrow account balance on success
 * PARAMETERS:
 *   - req (Request) : Raw body Express request from Stripe
 *   - res (Response) : Express response
 * RETURNS: void
 * WHO CALLS IT: POST /api/v1/escrow-accounts/webhooks/stripe
 * PRINCIPLE: SOLID, KISS
 * ============================================================================
 */
const handleStripeWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    let event;
    /**
     * 🧱 CODE BLOCK: Stripe Signature Verification
     * WHAT IT IS DOING: Validates the webhook came from Stripe (not a forged request)
     * WHY IT IS HERE  : Prevents fake deposit events from being processed
     * PRINCIPLE       : SOLID (Security concern in one place)
     */
    try {
        event = stripe_1.default.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        logger_middleware_1.logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
        return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }
    /**
     * 🧱 CODE BLOCK: Event Handler - payment_intent.succeeded
     * WHAT IT IS DOING: Credits the escrow account balance when Stripe confirms payment
     * WHY IT IS HERE  : This is the trigger that makes funds "available" in the escrow
     * PRINCIPLE       : KISS (One event type, one clear action)
     */
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const { escrowAccountId, type } = paymentIntent.metadata;
        const amount = Number(paymentIntent.metadata?.amount || paymentIntent.amount / 100);
        if (!escrowAccountId || type !== "deposit") {
            logger_middleware_1.logger.warn(`Stripe webhook: Missing or invalid metadata on PaymentIntent ${paymentIntent.id}`);
            return res.json({ received: true });
        }
        try {
            // 1. Get escrow account to read current balance
            const escrow = await db_js_1.default.escrowAccount.findUnique({
                where: { id: escrowAccountId },
                include: { project: true },
            });
            if (!escrow) {
                logger_middleware_1.logger.error(`Stripe webhook: Escrow account ${escrowAccountId} not found`);
                return res.status(404).json({ message: "Escrow account not found" });
            }
            await db_js_1.default.$transaction(async (tx) => {
                await tx.escrowAccount.update({
                    where: { id: escrowAccountId },
                    data: { balance: { increment: amount } },
                });
                const pendingTransaction = await tx.transaction.findFirst({
                    where: {
                        escrowAccountId,
                        reference: paymentIntent.id,
                        status: "pending",
                    },
                });
                if (pendingTransaction) {
                    await tx.transaction.update({
                        where: { id: pendingTransaction.id },
                        data: {
                            status: "completed",
                            completedAt: new Date(),
                            metadata: { provider: "stripe", paymentIntentId: paymentIntent.id },
                        },
                    });
                }
                else {
                    await tx.transaction.create({
                        data: {
                            escrowAccountId,
                            actorId: escrow.project.clientId,
                            type: "deposit",
                            method: "bank_transfer",
                            amount,
                            status: "completed",
                            reference: paymentIntent.id,
                            completedAt: new Date(),
                            metadata: { provider: "stripe", paymentIntentId: paymentIntent.id },
                        },
                    });
                }
            });
            await (0, notifications_js_1.notifyProjectParticipants)({
                projectId: escrow.projectId,
                excludeUserId: escrow.project.clientId,
                title: "Payment completed",
                body: `Deposit of ${amount} ${escrow.project.currency} was completed for ${escrow.project.name}`,
                data: {
                    type: "stripe_deposit_completed",
                    escrowAccountId,
                    paymentIntentId: paymentIntent.id,
                },
            });
            logger_middleware_1.logger.info(`Escrow deposit confirmed: +${amount} to account ${escrowAccountId} via Stripe`);
        }
        catch (dbErr) {
            logger_middleware_1.logger.error("Stripe webhook DB update failed:", dbErr);
            return res.status(500).json({ message: "DB update failed" });
        }
    }
    res.json({ received: true });
};
exports.handleStripeWebhook = handleStripeWebhook;

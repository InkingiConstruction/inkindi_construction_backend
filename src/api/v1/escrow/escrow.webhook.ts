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

import { Request, Response } from "express";
import stripe from "../../../integrations/stripe";
import prisma from "../../../config/db.js";
import { logger } from "../../../common/middleware/logger.middleware";

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
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event;

  /**
   * 🧱 CODE BLOCK: Stripe Signature Verification
   * WHAT IT IS DOING: Validates the webhook came from Stripe (not a forged request)
   * WHY IT IS HERE  : Prevents fake deposit events from being processed
   * PRINCIPLE       : SOLID (Security concern in one place)
   */
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  /**
   * 🧱 CODE BLOCK: Event Handler - payment_intent.succeeded
   * WHAT IT IS DOING: Credits the escrow account balance when Stripe confirms payment
   * WHY IT IS HERE  : This is the trigger that makes funds "available" in the escrow
   * PRINCIPLE       : KISS (One event type, one clear action)
   */
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as any;
    const { escrowAccountId, type } = paymentIntent.metadata;
    const amount = paymentIntent.amount / 100; // Convert from cents

    if (!escrowAccountId || type !== "deposit") {
      logger.warn(`Stripe webhook: Missing or invalid metadata on PaymentIntent ${paymentIntent.id}`);
      return res.json({ received: true });
    }

    try {
      // 1. Get escrow account to read current balance
      const escrow = await prisma.escrowAccount.findUnique({
        where: { id: escrowAccountId },
        include: { project: true },
      });

      if (!escrow) {
        logger.error(`Stripe webhook: Escrow account ${escrowAccountId} not found`);
        return res.status(404).json({ message: "Escrow account not found" });
      }

      // 2. Apply deposit to balance atomically
      await prisma.$transaction([
        prisma.escrowAccount.update({
          where: { id: escrowAccountId },
          data: { balance: { increment: amount } },
        }),
        prisma.transaction.create({
          data: {
            escrowAccountId,
            actorId: escrow.project.clientId, // Set actor to the client who owns the project
            type: "deposit",
            method: "bank_transfer",
            amount,
            status: "completed",
            reference: paymentIntent.id,
            completedAt: new Date(),
            metadata: { provider: "stripe", paymentIntentId: paymentIntent.id },
          },
        }),
      ]);

      logger.info(`Escrow deposit confirmed: +${amount} to account ${escrowAccountId} via Stripe`);
    } catch (dbErr) {
      logger.error("Stripe webhook DB update failed:", dbErr);
      return res.status(500).json({ message: "DB update failed" });
    }
  }

  res.json({ received: true });
};

"use strict";
/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : test-stripe-payment.ts
 * WHAT THIS FILE DOES : CLI script to test local Stripe Escrow deposits
 * HOW IT DOES IT      : Hits the Stripe deposit endpoint to create a PaymentIntent,
 *                       then signs a mock Stripe webhook payload locally and triggers
 *                       the webhook callback route to credit the escrow balance.
 * DATA SOURCE         : Local HTTP Server (http://localhost:3000)
 * DATA DESTINATION    : Local HTTP Server Webhook Endpoint
 * PRINCIPLE APPLIED   : KISS, SOLID
 * ============================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
// Configuration for local webhook testing
const BASE_URL = "http://localhost:3000/api/v1";
const ESCROW_ACCOUNT_ID = "replace-with-valid-escrow-account-id";
const CLIENT_TOKEN = "replace-with-valid-client-jwt-bearer-token";
const MOCK_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock_secret_key";
/**
 * ============================================================================
 * 🔧 FUNCTION: simulateStripeDepositAndWebhook
 * ============================================================================
 * WHAT IT DOES: Simulates creating a payment intent and triggering the webhook callback
 * PRINCIPLE: KISS
 * ============================================================================
 */
async function simulateStripeDepositAndWebhook() {
    console.log("🚀 Starting Stripe Escrow Deposit Simulation...");
    try {
        // 1. Create a Payment Intent via backend route
        console.log(`\n1. Requesting Stripe Payment Intent for Escrow Account: ${ESCROW_ACCOUNT_ID}...`);
        const depositResponse = await fetch(`${BASE_URL}/escrow-accounts/${ESCROW_ACCOUNT_ID}/deposit-stripe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CLIENT_TOKEN}`,
            },
            body: JSON.stringify({
                amount: 2500, // $2,500.00
                currency: "usd",
            }),
        });
        if (!depositResponse.ok) {
            const errorText = await depositResponse.text();
            throw new Error(`Failed to create deposit intent: ${errorText}`);
        }
        const { data: { paymentIntentId, clientSecret } } = await depositResponse.json();
        console.log(`✅ Payment Intent Created! ID: ${paymentIntentId}`);
        console.log(`🔑 Client Secret: ${clientSecret}`);
        // 2. Generate a mock Stripe webhook event payload
        console.log("\n2. Generating Mock Stripe payment_intent.succeeded event...");
        const timestamp = Math.floor(Date.now() / 1000);
        const mockPayload = JSON.stringify({
            id: "evt_test_" + crypto_1.default.randomBytes(8).toString("hex"),
            object: "event",
            api_version: "2025-02-24.acacia",
            created: timestamp,
            type: "payment_intent.succeeded",
            data: {
                object: {
                    id: paymentIntentId,
                    object: "payment_intent",
                    amount: 250000, // Cents
                    currency: "usd",
                    status: "succeeded",
                    metadata: {
                        escrowAccountId: ESCROW_ACCOUNT_ID,
                        type: "deposit",
                    },
                },
            },
        });
        // 3. Compute raw Stripe Webhook signature header
        // Header format: t=timestamp,v1=signature
        const signedPayload = `${timestamp}.${mockPayload}`;
        const hmac = crypto_1.default
            .createHmac("sha256", MOCK_WEBHOOK_SECRET)
            .update(signedPayload)
            .digest("hex");
        const stripeSignatureHeader = `t=${timestamp},v1=${hmac}`;
        console.log(`Generated Stripe-Signature: ${stripeSignatureHeader}`);
        // 4. Send Mock Webhook POST request to backend webhook endpoint
        console.log("\n3. Dispatching webhook event to local server callback...");
        const webhookResponse = await fetch(`${BASE_URL}/escrow-accounts/webhooks/stripe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Stripe-Signature": stripeSignatureHeader,
            },
            body: mockPayload,
        });
        const responseStatus = webhookResponse.status;
        const responseBody = await webhookResponse.json();
        if (responseStatus === 200) {
            console.log("\n🎉 Webhook processing completed successfully!");
            console.log("DB Escrow Balance updated and Transaction record successfully created.");
        }
        else {
            console.log(`\n❌ Webhook processed with status code ${responseStatus}`);
            console.log(responseBody);
        }
    }
    catch (err) {
        console.error("\n❌ Simulation error:", err.message);
        console.log("\n💡 Tip: Make sure your server is running (`npm run dev`) and you supplied valid test IDs/tokens.");
    }
}
// Execute the simulation
simulateStripeDepositAndWebhook();

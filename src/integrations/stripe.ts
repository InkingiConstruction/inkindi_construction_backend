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

import Stripe from "stripe";

/**
 * 🧱 CODE BLOCK: Stripe Initialization
 * WHAT IT IS DOING: Instantiates Stripe with the provided secret key
 * WHY IT IS HERE  : Centralizes the Stripe client so we don't initialize it in every controller
 * PRINCIPLE       : DRY
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia" as any, // Stripe API v2 - latest stable
});

export default stripe;

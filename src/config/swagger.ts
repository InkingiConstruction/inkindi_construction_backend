// src/config/swagger.ts
import swaggerJSDoc from "swagger-jsdoc";

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inkidi Construction API",
      version: "1.0.0",
      description:
        "Backend API for the Inkidi Construction platform — projects, milestones, escrow, wallets, KYC, suppliers.",
    },
    servers: [
      { url: "http://localhost:3000", description: "Local dev" },
      { url: "https://api.inkindi.example.com", description: "Production" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ─── Wallet ─────────────────────────────────────────────
        Wallet: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            balance: { type: "string", example: "150000.00" },
            currency: { type: "string", example: "RWF" },
            status: { type: "string", enum: ["active", "frozen", "closed"] },
            frozenReason: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        WalletTransaction: {
          type: "object",
          properties: {
            id: { type: "string" },
            walletId: { type: "string" },
            type: {
              type: "string",
              enum: [
                "funding",
                "withdrawal",
                "vault_deposit",
                "vault_refund",
                "milestone_payout",
                "penalty",
                "adjustment",
                "refund",
              ],
            },
            amount: { type: "string", example: "100000.00" },
            balanceBefore: { type: "string" },
            balanceAfter: { type: "string" },
            currency: { type: "string", example: "RWF" },
            status: { type: "string", enum: ["pending", "completed", "failed", "reversed"] },
            reference: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            metadata: { type: "object", nullable: true, additionalProperties: true },
            escrowAccountId: { type: "string", nullable: true },
            milestoneId: { type: "string", nullable: true },
            completedAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        FundingRequest: {
          type: "object",
          properties: {
            id: { type: "string" },
            walletId: { type: "string" },
            userId: { type: "string" },
            amount: { type: "string", example: "100000.00" },
            currency: { type: "string", example: "RWF" },
            method: {
              type: "string",
              enum: ["stripe", "mtn_momo", "airtel_money", "bank_transfer", "internal_transfer"],
            },
            status: {
              type: "string",
              enum: ["pending", "processing", "completed", "failed", "reversed"],
            },
            reference: { type: "string", nullable: true },
            providerRef: { type: "string", nullable: true },
            phoneNumber: { type: "string", nullable: true },
            failureReason: { type: "string", nullable: true },
            metadata: { type: "object", nullable: true, additionalProperties: true },
            expiresAt: { type: "string", format: "date-time", nullable: true },
            completedAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string" },
            escrowAccountId: { type: "string" },
            milestoneId: { type: "string", nullable: true },
            actorId: { type: "string" },
            type: {
              type: "string",
              enum: ["deposit", "release", "refund", "freeze", "unfreeze", "auto_payment", "penalty"],
            },
            method: {
              type: "string",
              enum: ["mtn_momo", "airtel_money", "bank_transfer"],
              nullable: true,
            },
            amount: { type: "string" },
            status: { type: "string", enum: ["pending", "completed", "failed", "reversed"] },
            reference: { type: "string", nullable: true },
            metadata: { type: "object", nullable: true, additionalProperties: true },
            completedAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./src/modules/**/*.controller.ts", "./src/modules/**/*.route.ts"],
});

export default swaggerSpec;

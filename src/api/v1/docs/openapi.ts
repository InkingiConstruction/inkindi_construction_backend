/**
 * ============================================================================
 * 📄 FILE: openapi.ts
 * PURPOSE: Single source of truth for the OpenAPI 3.0 spec.
 *          - Reusable component schemas (every Prisma model)
 *          - Security schemes (bearer + cookie auth)
 *          - Server URLs
 *          - Tag groups
 *
 *          Endpoint @swagger JSDoc comments in controllers are merged
 *          automatically. This file defines the static base document.
 * ============================================================================
 */

import { OpenAPIV3 } from "openapi-types";

/* --------------------------------------------------------------------------
 * 0. TYPES
 * ------------------------------------------------------------------------ */

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type RouteDoc = {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  roles?: string[];
  multipart?: boolean;
  body?: Record<string, unknown>;
  query?: string[];
};

/* --------------------------------------------------------------------------
 * 1. CONSTANTS
 * ------------------------------------------------------------------------ */

const allRoles = ["client", "engineer", "supervisor", "supplier", "admin"];

/* --------------------------------------------------------------------------
 * 2. REUSABLE COMPONENT SCHEMAS
 *    Every Prisma model is mirrored here so it can be referenced via
 *    $ref: '#/components/schemas/ModelName' in endpoint docs.
 * ------------------------------------------------------------------------ */

const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  // ── Generic ────────────────────────────────────────────────────
  Error: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
  },

  // ── User ───────────────────────────────────────────────────────
  User: {
    type: "object",
    properties: {
      id: { type: "string", example: "u_abc123" },
      name: { type: "string", example: "Robert Mugisha" },
      email: { type: "string", format: "email", example: "robert@example.com" },
      emailVerified: { type: "boolean" },
      role: { type: "string", enum: ["client", "engineer", "supervisor", "supplier", "admin"] },
      username: { type: "string", nullable: true },
      displayUsername: { type: "string", nullable: true },
      phoneNumber: { type: "string", nullable: true, example: "+250788123456" },
      phoneNumberVerified: { type: "boolean", nullable: true },
      image: { type: "string", nullable: true },
      kycStatus: {
        type: "string",
        enum: [
          "not_submitted",
          "submitted",
          "under_review",
          "additional_info_requested",
          "approved",
          "rejected",
        ],
      },
      kycSubmittedAt: { type: "string", format: "date-time", nullable: true },
      kycReviewedAt: { type: "string", format: "date-time", nullable: true },
      kycRejectionReason: { type: "string", nullable: true },
      banned: { type: "boolean", nullable: true },
      banReason: { type: "string", nullable: true },
      banExpires: { type: "string", format: "date-time", nullable: true },
      lastLoginAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── AuthOtp ────────────────────────────────────────────────────
  AuthOtp: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string", nullable: true },
      email: { type: "string", format: "email" },
      type: { type: "string", example: "email-verification" },
      attempts: { type: "integer", example: 0 },
      expiresAt: { type: "string", format: "date-time" },
      usedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ── KycDocument ────────────────────────────────────────────────
  KycDocument: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      type: {
        type: "string",
        enum: [
          "national_id",
          "passport",
          "ier_license",
          "ier_certificate",
          "ier_corporate_license",
          "indemnity_insurance",
          "business_registration",
          "rdb_certificate",
          "tax_compliance",
          "tin_certificate",
          "certification",
          "practice_license",
          "accreditation_cert",
        ],
      },
      cloudinaryUrl: { type: "string", format: "uri" },
      publicId: { type: "string" },
      status: { type: "string", enum: ["pending", "approved", "rejected"] },
      reviewNote: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── Project ────────────────────────────────────────────────────
  Project: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string", example: "Kigali Heights Tower" },
      description: { type: "string", nullable: true },
      category: { type: "string", nullable: true },
      status: {
        type: "string",
        enum: ["draft", "active", "paused", "completed", "terminated"],
      },
      budget: { type: "string", example: "5000000.00" },
      currency: { type: "string", example: "RWF" },
      address: { type: "string", nullable: true },
      area: { type: "string", nullable: true, example: "250.00" },
      upi: { type: "string", nullable: true },
      ownerName: { type: "string", nullable: true },
      landUse: { type: "string", nullable: true },
      gpsBoundary: { type: "object", nullable: true, additionalProperties: true },
      sitePhotos: { type: "array", items: { type: "string" } },
      architecturalPlans: { type: "array", items: { type: "string" } },
      startDate: { type: "string", format: "date-time", nullable: true },
      endDate: { type: "string", format: "date-time", nullable: true },
      clientId: { type: "string" },
      engineerId: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── ProjectMember ──────────────────────────────────────────────
  ProjectMember: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      userId: { type: "string" },
      role: { type: "string", example: "supervisor" },
      status: { type: "string", enum: ["pending", "accepted", "declined", "removed"] },
      invitedAt: { type: "string", format: "date-time" },
      acceptedAt: { type: "string", format: "date-time", nullable: true },
      removedAt: { type: "string", format: "date-time", nullable: true },
    },
  },

  // ── EscrowAccount ──────────────────────────────────────────────
  EscrowAccount: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      balance: { type: "string", example: "70000.00" },
      lockedBalance: { type: "string", example: "0.00" },
      currency: { type: "string", example: "RWF" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── Transaction (escrow-side) ──────────────────────────────────
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
      amount: { type: "string", example: "100000.00" },
      status: { type: "string", enum: ["pending", "completed", "failed", "reversed"] },
      reference: { type: "string", nullable: true },
      metadata: { type: "object", nullable: true, additionalProperties: true },
      completedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── Milestone ──────────────────────────────────────────────────
  Milestone: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      engineerId: { type: "string" },
      name: { type: "string" },
      description: { type: "string", nullable: true },
      budgetPercentage: { type: "string", example: "25.00" },
      durationDays: { type: "integer", nullable: true },
      acceptanceCriteria: { type: "string", nullable: true },
      dependsOn: { type: "string", nullable: true },
      order: { type: "integer" },
      status: {
        type: "string",
        enum: [
          "pending",
          "active",
          "pending_supervisor",
          "revision_required",
          "awaiting_client_payment",
          "paid",
        ],
      },
      completedAt: { type: "string", format: "date-time", nullable: true },
      paidAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── BoqItem ────────────────────────────────────────────────────
  BoqItem: {
    type: "object",
    properties: {
      id: { type: "string" },
      milestoneId: { type: "string" },
      supplierInventoryItemId: { type: "string", nullable: true },
      category: { type: "string" },
      name: { type: "string" },
      quantity: { type: "string" },
      unit: { type: "string" },
      unitPrice: { type: "string" },
      totalPrice: { type: "string" },
      actualCost: { type: "string", nullable: true },
      notes: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── SupplierInventoryItem ──────────────────────────────────────
  SupplierInventoryItem: {
    type: "object",
    properties: {
      id: { type: "string" },
      supplierId: { type: "string" },
      category: { type: "string" },
      name: { type: "string" },
      unit: { type: "string" },
      unitPrice: { type: "string" },
      deliveryFee: { type: "string", nullable: true },
      available: { type: "boolean" },
      notes: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── Rfq ────────────────────────────────────────────────────────
  Rfq: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      milestoneId: { type: "string" },
      engineerId: { type: "string" },
      title: { type: "string" },
      specs: { type: "object", additionalProperties: true },
      quantity: { type: "string" },
      unit: { type: "string" },
      deadline: { type: "string", format: "date-time" },
      status: { type: "string", enum: ["open", "closed", "cancelled"] },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── Quote ──────────────────────────────────────────────────────
  Quote: {
    type: "object",
    properties: {
      id: { type: "string" },
      rfqId: { type: "string" },
      supplierId: { type: "string" },
      unitPrice: { type: "string" },
      totalPrice: { type: "string" },
      deliveryDays: { type: "integer" },
      warrantyMonths: { type: "integer", nullable: true },
      terms: { type: "string", nullable: true },
      certUrls: { type: "array", items: { type: "string" } },
      status: { type: "string", enum: ["pending_selection", "selected", "rejected"] },
      selectedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── PurchaseOrder ──────────────────────────────────────────────
  PurchaseOrder: {
    type: "object",
    properties: {
      id: { type: "string" },
      rfqId: { type: "string" },
      quoteId: { type: "string" },
      supplierId: { type: "string" },
      poNumber: { type: "string" },
      cloudinaryUrl: { type: "string" },
      status: { type: "string", enum: ["issued", "accepted", "shipped", "completed"] },
      issuedAt: { type: "string", format: "date-time" },
      acceptedAt: { type: "string", format: "date-time", nullable: true },
      completedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── Delivery ───────────────────────────────────────────────────
  Delivery: {
    type: "object",
    properties: {
      id: { type: "string" },
      purchaseOrderId: { type: "string" },
      supplierId: { type: "string" },
      status: {
        type: "string",
        enum: [
          "preparing",
          "in_transit",
          "delivered",
          "pending_confirmation",
          "confirmed",
          "rejected",
        ],
      },
      startGps: { type: "object", nullable: true, additionalProperties: true },
      endGps: { type: "object", nullable: true, additionalProperties: true },
      proofPhotos: { type: "array", items: { type: "string" } },
      notes: { type: "string", nullable: true },
      rejectionReason: { type: "string", nullable: true },
      startedAt: { type: "string", format: "date-time", nullable: true },
      arrivedAt: { type: "string", format: "date-time", nullable: true },
      confirmedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── ProgressPhoto ──────────────────────────────────────────────
  ProgressPhoto: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      milestoneId: { type: "string", nullable: true },
      progressGroupId: { type: "string", nullable: true },
      uploadedById: { type: "string" },
      cloudinaryUrl: { type: "string" },
      publicId: { type: "string" },
      gpsLocation: { type: "object", nullable: true, additionalProperties: true },
      caption: { type: "string", nullable: true },
      isVideo: { type: "boolean" },
      videoDuration: { type: "integer", nullable: true },
      reviewStatus: { type: "string", enum: ["pending", "approved", "rejected"] },
      supervisorComment: { type: "string", nullable: true },
      reviewedById: { type: "string", nullable: true },
      reviewedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ── Inspection ─────────────────────────────────────────────────
  Inspection: {
    type: "object",
    properties: {
      id: { type: "string" },
      milestoneId: { type: "string" },
      supervisorId: { type: "string" },
      checklist: { type: "object", additionalProperties: true },
      photos: { type: "array", items: { type: "string" } },
      rating: { type: "integer", nullable: true },
      signatureUrl: { type: "string", nullable: true },
      notes: { type: "string", nullable: true },
      decision: { type: "string", enum: ["approved", "revision_required"], nullable: true },
      attemptNumber: { type: "integer" },
      signedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── Dispute ────────────────────────────────────────────────────
  Dispute: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      milestoneId: { type: "string", nullable: true },
      raisedById: { type: "string" },
      category: { type: "string", enum: ["quality", "timeline", "cost", "other"] },
      description: { type: "string" },
      status: {
        type: "string",
        enum: [
          "open",
          "under_review",
          "resolved_full_payment",
          "resolved_partial",
          "resolved_refund",
          "resolved_termination",
          "closed",
        ],
      },
      amountInDispute: { type: "string" },
      resolution: { type: "object", nullable: true, additionalProperties: true },
      resolvedAt: { type: "string", format: "date-time", nullable: true },
      resolvedBy: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── DisputeEvidence ────────────────────────────────────────────
  DisputeEvidence: {
    type: "object",
    properties: {
      id: { type: "string" },
      disputeId: { type: "string" },
      uploadedById: { type: "string" },
      cloudinaryUrl: { type: "string" },
      description: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ── Message ────────────────────────────────────────────────────
  Message: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string", nullable: true },
      senderId: { type: "string" },
      recipientId: { type: "string", nullable: true },
      content: { type: "string" },
      photoUrl: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      editedAt: { type: "string", format: "date-time", nullable: true },
    },
  },

  // ── Notification ───────────────────────────────────────────────
  Notification: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      channel: { type: "string", enum: ["push", "email", "sms", "in_app"] },
      title: { type: "string" },
      body: { type: "string" },
      data: { type: "object", additionalProperties: true },
      status: {
        type: "string",
        enum: ["pending", "sent", "delivered", "failed", "read"],
      },
      sentAt: { type: "string", format: "date-time", nullable: true },
      deliveredAt: { type: "string", format: "date-time", nullable: true },
      readAt: { type: "string", format: "date-time", nullable: true },
      failureReason: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ── AuditLog ───────────────────────────────────────────────────
  AuditLog: {
    type: "object",
    properties: {
      id: { type: "string" },
      actorId: { type: "string", nullable: true },
      action: { type: "string", example: "USER_REGISTERED" },
      entityType: { type: "string", example: "User" },
      entityId: { type: "string", nullable: true },
      projectId: { type: "string", nullable: true },
      oldValues: { type: "object", nullable: true, additionalProperties: true },
      newValues: { type: "object", nullable: true, additionalProperties: true },
      ipAddress: { type: "string", nullable: true },
      userAgent: { type: "string", nullable: true },
      result: { type: "string", example: "success" },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ── ActivityLog ────────────────────────────────────────────────
  ActivityLog: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      action: { type: "string" },
      metadata: { type: "object", nullable: true, additionalProperties: true },
      ipAddress: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ── ApiKey ─────────────────────────────────────────────────────
  ApiKey: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      name: { type: "string" },
      prefix: { type: "string" },
      permissions: { type: "array", items: { type: "string" } },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      lastUsedAt: { type: "string", format: "date-time", nullable: true },
      revokedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ── SystemSetting ──────────────────────────────────────────────
  SystemSetting: {
    type: "object",
    properties: {
      id: { type: "string" },
      key: { type: "string" },
      value: { type: "object", additionalProperties: true },
      description: { type: "string", nullable: true },
      updatedBy: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── EmailTemplate ──────────────────────────────────────────────
  EmailTemplate: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      subject: { type: "string" },
      htmlContent: { type: "string" },
      plainText: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // 💰 WALLET MODELS
  // ════════════════════════════════════════════════════════════════

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
      amount: { type: "string", example: "100000.00", description: "Positive = credit, negative = debit" },
      balanceBefore: { type: "string" },
      balanceAfter: { type: "string" },
      currency: { type: "string", example: "RWF" },
      status: { type: "string", enum: ["pending", "completed", "failed", "reversed"] },
      reference: { type: "string", nullable: true },
      description: { type: "string", nullable: true },
      metadata: { type: "object", nullable: true, additionalProperties: true },
      escrowAccountId: { type: "string", nullable: true },
      milestoneId: { type: "string", nullable: true },
      counterpartyId: { type: "string", nullable: true },
      completedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
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
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // ── Wallet summary (extended shape returned by GET /wallet) ───
  WalletSummary: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      balance: { type: "string" },
      currency: { type: "string" },
      status: { type: "string" },
      frozenReason: { type: "string", nullable: true },
      availableBalance: { type: "string" },
      totalInProjectVaults: { type: "string" },
      netFlow: { type: "string" },
      transactions: { type: "array", items: { $ref: "#/components/schemas/WalletTransaction" } },
      _count: {
        type: "object",
        properties: {
          transactions: { type: "integer" },
          fundingRequests: { type: "integer" },
        },
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  ProjectVaultSummary: {
    type: "object",
    properties: {
      escrowAccountId: { type: "string" },
      projectId: { type: "string" },
      projectName: { type: "string" },
      projectStatus: { type: "string", enum: ["draft", "active", "paused", "completed", "terminated"] },
      currency: { type: "string" },
      currentBalance: { type: "string" },
      yourDeposits: { type: "string" },
      yourReleases: { type: "string" },
      yourNet: { type: "string" },
    },
  },

  ProjectVaultDetails: {
    type: "object",
    properties: {
      escrowAccountId: { type: "string" },
      projectId: { type: "string" },
      projectName: { type: "string" },
      currency: { type: "string" },
      currentBalance: { type: "string" },
      lockedBalance: { type: "string" },
      yourTotalDeposited: { type: "string" },
      transactions: { type: "array", items: { $ref: "#/components/schemas/Transaction" } },
    },
  },
};

/* --------------------------------------------------------------------------
 * 3. ROUTE DEFINITIONS
 * ------------------------------------------------------------------------ */

const modelRoutes = [
  { base: "/users", tag: "Users", name: "User", roles: { create: ["admin"], read: ["admin"], update: ["admin"], delete: ["admin"] }, multipart: true },
  { base: "/projects", tag: "Projects", name: "Project", roles: { create: ["client"], read: allRoles, update: ["client", "engineer", "admin"], delete: ["client", "admin"] }, multipart: true },
  { base: "/project-members", tag: "Project Members", name: "ProjectMember", roles: { create: ["client", "engineer", "admin"], read: allRoles, update: allRoles, delete: ["client", "engineer", "admin"] }, query: ["projectId", "status"] },
  { base: "/transactions", tag: "Transactions", name: "Transaction", roles: { create: ["client", "admin"], read: ["client", "engineer", "admin"], update: ["admin"], delete: ["admin"] } },
  { base: "/milestones", tag: "Milestones", name: "Milestone", roles: { create: ["engineer", "admin"], read: ["client", "engineer", "supervisor", "admin"], update: ["engineer", "supervisor", "admin"], delete: ["engineer", "admin"] } },
  { base: "/boq-items", tag: "BOQ Items", name: "BoqItem", roles: { create: ["engineer", "admin"], read: allRoles, update: ["engineer", "admin"], delete: ["engineer", "admin"] } },
  { base: "/rfqs", tag: "RFQs", name: "Rfq", roles: { create: ["engineer", "admin"], read: ["engineer", "supplier", "admin"], update: ["engineer", "admin"], delete: ["engineer", "admin"] } },
  { base: "/quotes", tag: "Quotes", name: "Quote", roles: { create: ["supplier"], read: ["engineer", "supplier", "admin"], update: ["supplier", "engineer", "admin"], delete: ["supplier", "admin"] }, multipart: true },
  { base: "/purchase-orders", tag: "Purchase Orders", name: "PurchaseOrder", roles: { create: ["engineer", "admin"], read: ["engineer", "supplier", "admin"], update: ["supplier", "engineer", "admin"], delete: ["admin"] }, multipart: true },
  { base: "/deliveries", tag: "Deliveries", name: "Delivery", roles: { create: ["supplier"], read: ["client", "engineer", "supplier", "admin"], update: ["supplier", "engineer", "client", "admin"], delete: ["supplier", "admin"] }, multipart: true },
  { base: "/progress-photos", tag: "Progress Photos", name: "ProgressPhoto", roles: { create: ["engineer", "supervisor", "admin"], read: ["client", "engineer", "supervisor", "admin"], update: ["engineer", "supervisor", "admin"], delete: ["engineer", "supervisor", "admin"] }, multipart: true },
  { base: "/inspections", tag: "Inspections", name: "Inspection", roles: { create: ["supervisor", "admin"], read: ["client", "engineer", "supervisor", "admin"], update: ["supervisor", "admin"], delete: ["supervisor", "admin"] }, multipart: true },
  { base: "/disputes", tag: "Disputes", name: "Dispute", roles: { create: ["client", "engineer", "supplier"], read: ["client", "engineer", "supplier", "admin"], update: ["admin"], delete: ["admin"] } },
  { base: "/dispute-evidence", tag: "Dispute Evidence", name: "DisputeEvidence", roles: { create: ["client", "engineer", "supplier"], read: ["client", "engineer", "supplier", "admin"], update: ["client", "engineer", "supplier", "admin"], delete: ["client", "engineer", "supplier", "admin"] }, multipart: true },
  { base: "/messages", tag: "Messages", name: "Message", roles: { create: allRoles, read: allRoles, update: allRoles, delete: allRoles }, multipart: true },
  { base: "/notifications", tag: "Notifications", name: "Notification", roles: { create: ["admin"], read: allRoles, update: allRoles, delete: allRoles } },
  { base: "/audit-logs", tag: "Audit Logs", name: "AuditLog", roles: { create: ["admin"], read: ["admin"], update: ["admin"], delete: ["admin"] } },
  { base: "/activity-logs", tag: "Activity Logs", name: "ActivityLog", roles: { create: allRoles, read: allRoles, update: ["admin"], delete: ["admin"] } },
  { base: "/api-keys", tag: "API Keys", name: "ApiKey", roles: { create: allRoles, read: allRoles, update: allRoles, delete: allRoles } },
  { base: "/system-settings", tag: "System Settings", name: "SystemSetting", roles: { create: ["admin"], read: ["admin"], update: ["admin"], delete: ["admin"] } },
  { base: "/email-templates", tag: "Email Templates", name: "EmailTemplate", roles: { create: ["admin"], read: ["admin"], update: ["admin"], delete: ["admin"] } },
];

const authRoutes: RouteDoc[] = (
  [
    ["post", "/auth/register", "Register with email and password", { email: "client@example.com", password: "SecurePassword123!", name: "Jean Bosco", role: "client", phoneNumber: "+250788123456" }],
    ["post", "/auth/login", "Login with email and password", { email: "client@example.com", password: "SecurePassword123!" }],
    ["post", "/auth/verify-email", "Verify email OTP", { email: "client@example.com", otp: "123456" }],
    ["post", "/auth/resend-otp", "Resend email OTP", { email: "client@example.com" }],
    ["get", "/auth/me", "Get current authenticated user"],
    ["post", "/auth/logout", "Logout current user"],
  ] as [string, string, string, Record<string, unknown> | undefined][]
).map(([method, path, summary, body]) => ({
  method: method as HttpMethod,
  path,
  tag: "Auth",
  summary,
  body,
}));

const customRoutes: RouteDoc[] = [
  { method: "get", path: "/users/engineers", tag: "Users", summary: "List engineers available for project assignment", roles: ["client", "admin"] },

  { method: "post", path: "/kyc/documents", tag: "KYC", summary: "Upload a KYC document", roles: allRoles, multipart: true, body: { type: "national_id" } },
  { method: "get", path: "/kyc/status", tag: "KYC", summary: "Get current user KYC status", roles: allRoles },
  { method: "get", path: "/kyc/pending", tag: "KYC", summary: "List pending KYC submissions", roles: ["admin"] },
  { method: "post", path: "/kyc/{userId}/approve", tag: "KYC", summary: "Approve user KYC", roles: ["admin"] },
  { method: "post", path: "/kyc/{userId}/reject", tag: "KYC", summary: "Reject user KYC", roles: ["admin"], body: { reason: "Document is not readable" } },

  { method: "patch", path: "/projects/{id}/status", tag: "Projects", summary: "Toggle or set project status", roles: ["client", "engineer", "admin"], body: { status: "active" } },
  { method: "patch", path: "/projects/{id}/images", tag: "Projects", summary: "Replace one project image by publicId", roles: ["client", "engineer", "admin"], multipart: true, body: { collection: "sitePhotos", publicId: "cloudinary_public_id" } },
  { method: "delete", path: "/projects/{id}/images", tag: "Projects", summary: "Delete one project image by publicId", roles: ["client", "engineer", "admin"], body: { collection: "sitePhotos", publicId: "cloudinary_public_id" } },

  { method: "post", path: "/project-members/{id}/accept", tag: "Project Members", summary: "Accept a project assignment", roles: ["engineer", "admin"] },
  { method: "post", path: "/project-members/{id}/reject", tag: "Project Members", summary: "Reject a project assignment", roles: ["engineer", "admin"] },

  // ══════════════════════════════════════════════════════════════
  // 💰 WALLET ROUTES
  // ══════════════════════════════════════════════════════════════
  { method: "get", path: "/wallet", tag: "Wallet", summary: "Get current user's wallet summary", roles: allRoles },
  { method: "get", path: "/wallet/transactions", tag: "Wallet", summary: "Get paginated wallet transaction history", roles: allRoles, query: ["page", "limit", "type"] },
  { method: "post", path: "/wallet/fund", tag: "Wallet", summary: "Initiate a wallet funding request (Stripe / MTN Momo)", roles: ["client"], body: { amount: 100000, method: "stripe", phoneNumber: "+250788123456" } },
  { method: "post", path: "/wallet/fund/{fundingId}/confirm", tag: "Wallet", summary: "Simulate a successful provider confirmation (TEST ONLY)", roles: ["client", "admin"] },
  { method: "post", path: "/wallet/transfer-to-vault", tag: "Wallet", summary: "Transfer money from your wallet to a project vault", roles: ["client"], body: { escrowAccountId: "clw7x8h3z0001abc123def456", amount: 70000, description: "Phase 1 funding" } },
  { method: "get", path: "/wallet/project-vaults", tag: "Wallet", summary: "List all project vaults the user has funded", roles: allRoles },
  { method: "get", path: "/wallet/project-vaults/{escrowAccountId}", tag: "Wallet", summary: "Get details for a specific project vault", roles: allRoles },

  { method: "post", path: "/admin/wallets/{userId}/freeze", tag: "Admin", summary: "Freeze a user's wallet", roles: ["admin"], body: { reason: "Suspicious activity" } },
  { method: "post", path: "/admin/wallets/{userId}/unfreeze", tag: "Admin", summary: "Unfreeze a user's wallet", roles: ["admin"] },
];

const crudRoutes: RouteDoc[] = modelRoutes.flatMap((route) => [
  { method: "post" as const, path: route.base, tag: route.tag, summary: `Create ${route.name}`, roles: route.roles.create, multipart: route.multipart },
  { method: "get" as const, path: route.base, tag: route.tag, summary: `List ${route.name} records`, roles: route.roles.read, query: route.query },
  { method: "get" as const, path: `${route.base}/{id}`, tag: route.tag, summary: `Get ${route.name} by ID`, roles: route.roles.read },
  { method: "put" as const, path: `${route.base}/{id}`, tag: route.tag, summary: `Update ${route.name}`, roles: route.roles.update, multipart: route.multipart },
  { method: "delete" as const, path: `${route.base}/{id}`, tag: route.tag, summary: `Delete ${route.name}`, roles: route.roles.delete },
]);

const routes = [...authRoutes, ...customRoutes, ...crudRoutes];

/* --------------------------------------------------------------------------
 * 4. HELPERS
 * ------------------------------------------------------------------------ */

const buildPropertiesFromExample = (body: Record<string, unknown> | undefined) => {
  if (!body) return undefined;
  const properties: Record<string, OpenAPIV3.SchemaObject> = {};
  for (const [key, value] of Object.entries(body)) {
    const valType = typeof value;
    if (valType === "number") {
      properties[key] = { type: "number", example: value };
    } else if (valType === "boolean") {
      properties[key] = { type: "boolean", example: value };
    } else if (Array.isArray(value)) {
      properties[key] = { type: "array", items: { type: "string" }, example: value };
    } else if (value && valType === "object") {
      properties[key] = { type: "object", example: value };
    } else {
      properties[key] = { type: "string", example: value };
    }
  }
  return properties;
};

const createRequestBody = (route: RouteDoc): OpenAPIV3.RequestBodyObject | undefined => {
  if (!["post", "put", "patch"].includes(route.method)) return undefined;

  if (route.multipart) {
    const customProps = buildPropertiesFromExample(route.body) ?? {};
    return {
      required: false,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            additionalProperties: true,
            properties: {
              ...customProps,
              files: { type: "array", items: { type: "string", format: "binary" } },
            },
          },
        },
      },
    };
  }

  return {
    required: false,
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: true,
          properties: buildPropertiesFromExample(route.body),
          example: route.body ?? {},
        },
      },
    },
  };
};

const createParameters = (route: RouteDoc): OpenAPIV3.ParameterObject[] => {
  const pathParams: OpenAPIV3.ParameterObject[] = [...route.path.matchAll(/{([^}]+)}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));

  const queryParams: OpenAPIV3.ParameterObject[] = (route.query ?? []).map((name) => ({
    name,
    in: "query",
    required: false,
    schema: { type: "string" },
  }));

  return [...pathParams, ...queryParams];
};

/** Map a route tag to the appropriate response schema reference */
const getResponseSchema = (tag: string, summary: string): OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject => {
  if (tag === "Wallet") {
    if (summary.includes("summary")) return { $ref: "#/components/schemas/WalletSummary" };
    if (summary.includes("List all project vaults")) return {
      type: "object",
      properties: { items: { type: "array", items: { $ref: "#/components/schemas/ProjectVaultSummary" } } },
    };
    if (summary.includes("Get details for a specific project vault")) return { $ref: "#/components/schemas/ProjectVaultDetails" };
    if (summary.includes("history")) return {
      type: "object",
      properties: {
        items: { type: "array", items: { $ref: "#/components/schemas/WalletTransaction" } },
        total: { type: "integer" },
        page: { type: "integer" },
        limit: { type: "integer" },
        totalPages: { type: "integer" },
      },
    };
    if (summary.includes("funding request")) return { $ref: "#/components/schemas/FundingRequest" };
    return { $ref: "#/components/schemas/Wallet" };
  }

  // Map standard tags to schema references
  const tagToSchema: Record<string, string> = {
    Users: "User",
    Projects: "Project",
    "Project Members": "ProjectMember",
    Transactions: "Transaction",
    Milestones: "Milestone",
    "BOQ Items": "BoqItem",
    RFQs: "Rfq",
    Quotes: "Quote",
    "Purchase Orders": "PurchaseOrder",
    Deliveries: "Delivery",
    "Progress Photos": "ProgressPhoto",
    Inspections: "Inspection",
    Disputes: "Dispute",
    "Dispute Evidence": "DisputeEvidence",
    Messages: "Message",
    Notifications: "Notification",
    "Audit Logs": "AuditLog",
    "Activity Logs": "ActivityLog",
    "API Keys": "ApiKey",
    "System Settings": "SystemSetting",
    "Email Templates": "EmailTemplate",
  };

  const schemaName = tagToSchema[tag];
  if (schemaName) return { $ref: `#/components/schemas/${schemaName}` };

  return { type: "object" };
};

const buildResponses = (route: RouteDoc): OpenAPIV3.ResponsesObject => {
  const successSchema = getResponseSchema(route.tag, route.summary);
  const isList = route.method === "get" && !route.path.includes("{") && route.summary.toLowerCase().includes("list");
  const isGetById = route.method === "get" && route.path.includes("{");

  const successBody: OpenAPIV3.ResponseObject = {
    description: route.method === "post" ? "Created" : "Success",
    content: { "application/json": { schema: isList ? { type: "array", items: successSchema } : successSchema } },
  };

  return {
    200: successBody,
    201: { description: "Created", content: { "application/json": { schema: successSchema } } },
    400: {
      description: "Bad request",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    },
    403: {
      description: "Forbidden",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    },
  };
};

/* --------------------------------------------------------------------------
 * 5. BUILD PATHS
 * ------------------------------------------------------------------------ */

const paths = routes.reduce<Record<string, Record<string, unknown>>>((acc, route) => {
  acc[route.path] ??= {};
  acc[route.path][route.method] = {
    tags: [route.tag],
    summary: route.summary,
    description: route.roles?.length
      ? `**Allowed roles:** ${route.roles.join(", ")}`
      : undefined,
    security: route.path.startsWith("/auth") ? [] : [{ cookieAuth: [] }, { bearerAuth: [] }],
    parameters: createParameters(route),
    requestBody: createRequestBody(route),
    responses: buildResponses(route),
  };
  return acc;
}, {});

/* --------------------------------------------------------------------------
 * 6. EXPORT
 * ------------------------------------------------------------------------ */

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Inkingi Construction API",
    version: "1.0.0",
    description:
      "Versioned REST API documentation for the Inkingi Construction platform — projects, milestones, escrow, wallets, KYC, suppliers, disputes, RFQs.",
  },
  servers: [
    { url: "https://inkindi-construction-backend.onrender.com/api/v1", description: "Production" },
    { url: "http://localhost:3000/api/v1", description: "Local development" },
  ],
  tags: [...new Set(routes.map((r) => r.tag))].map((name) => ({ name })),
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "token" },
    },
    schemas,
  },
  paths,
};

export default openApiDocument;

/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : kyc.service.ts
 * WHAT THIS FILE DOES : Handles all KYC document upload, status retrieval, and admin decision logic
 * HOW IT DOES IT      : Performs Prisma DB queries and sends approval/rejection emails via Resend
 * DATA SOURCE         : Controller parameters (userId, role, document data)
 * DATA DESTINATION    : Prisma PostgreSQL + Resend email API
 * PRINCIPLE APPLIED   : SOLID (Business logic isolated from HTTP layer)
 * ============================================================================
 */

import { KycDocumentType } from "@prisma/client";
import prisma from "../../../config/db.js";
import { sendEmail } from "../../../config/resend.js";
import { kycApprovedTemplate, kycRejectedTemplate } from "../../../utils/email-tempelates.js";

/**
 * 🧱 CODE BLOCK: Required Document Map
 * WHAT IT IS DOING: Defines which KYC document types each role must submit
 * WHY IT IS HERE  : Central registry to validate and approve document submissions per role
 * PRINCIPLE       : DRY
 */
const REQUIRED_DOCUMENTS: Record<string, KycDocumentType[]> = {
  client: ["national_id"],
  supervisor: ["national_id", "practice_license"],
  engineer: ["national_id", "ier_certificate"],
  supplier: ["rdb_certificate", "tin_certificate"],
  site_agent: ["national_id", "site_operations_reference"],
};

const OPTIONAL_DOCUMENTS: Record<string, KycDocumentType[]> = {
  client: ["passport"],
  supervisor: ["passport", "rdb_certificate", "accreditation_cert", "certification", "indemnity_insurance"],
  engineer: ["passport", "rdb_certificate", "ier_license", "ier_corporate_license", "business_registration", "indemnity_insurance"],
  supplier: ["business_registration", "tax_compliance", "national_id"],
  site_agent: ["passport", "certification"],
};

const getRoleSpecificValue = (roleSpecific: unknown, key: string) => {
  if (!roleSpecific || typeof roleSpecific !== "object" || Array.isArray(roleSpecific)) {
    return undefined;
  }

  return (roleSpecific as Record<string, unknown>)[key];
};

const getRequiredDocuments = (role: string, roleSpecific?: unknown): KycDocumentType[] => {
  if (role === "engineer") {
    return getRoleSpecificValue(roleSpecific, "engineerType") === "company"
      ? ["rdb_certificate", "ier_corporate_license"]
      : ["national_id", "ier_certificate"];
  }

  if (role === "supervisor") {
    return getRoleSpecificValue(roleSpecific, "supervisorType") === "company"
      ? ["rdb_certificate", "accreditation_cert"]
      : ["national_id", "practice_license"];
  }

  return REQUIRED_DOCUMENTS[role] ?? [];
};

export class KycService {
  /**
   * ============================================================================
   * 🔧 FUNCTION: uploadDocument
   * ============================================================================
   * WHAT IT DOES: Validates and upserts a KYC document for the given user
   * PARAMETERS:
   *   - userId (string) : Authenticated user ID
   *   - userRole (string) : User's role to check document type eligibility
   *   - emailVerified (boolean) : Guards against unverified email submissions
   *   - phoneVerified (boolean) : Guards against unverified phone submissions
   *   - type (string) : KYC document type
   *   - cloudinaryUrl (string) : Hosted document URL
   *   - publicId (string) : Cloudinary public ID for the document
   * RETURNS: Promise<any> - Upserted KYC document record
   * WHO CALLS IT: kyc.controller.ts
   * PRINCIPLE: SOLID
   * ============================================================================
   */
  static async uploadDocument(
    userId: string,
    userRole: string,
    emailVerified: boolean,
    phoneVerified: boolean,
    type: string,
    cloudinaryUrl: string,
    publicId: string
  ) {
    if (!emailVerified) throw new Error("EMAIL_UNVERIFIED");
    if (!phoneVerified) throw new Error("PHONE_UNVERIFIED");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { roleSpecific: true },
    });

    const allowed = [
      ...getRequiredDocuments(userRole, user?.roleSpecific),
      ...(OPTIONAL_DOCUMENTS[userRole] ?? []),
    ];
    if (!allowed.includes(type as KycDocumentType)) {
      throw new Error(`INVALID_DOC_TYPE:${type}`);
    }

    const existing = await prisma.kycDocument.findFirst({ where: { userId, type: type as KycDocumentType } });

    const document = await prisma.kycDocument.upsert({
      where: { id: existing?.id ?? "new" },
      update: { cloudinaryUrl, publicId, status: "pending" },
      create: { userId, type: type as KycDocumentType, cloudinaryUrl, publicId },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "submitted", kycSubmittedAt: new Date(), kycRejectionReason: null },
    });

    return document;
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: getKycStatus
   * ============================================================================
   * WHAT IT DOES: Returns current KYC status and submitted documents for a user
   * PARAMETERS:
   *   - userId (string) : Authenticated user ID
   * RETURNS: Promise<any> - KYC status payload with documents
   * ============================================================================
   */
  static async getKycStatus(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycRejectionReason: true,
        kycDocuments: {
          select: { id: true, type: true, status: true, reviewNote: true, createdAt: true },
        },
      },
    });
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: getPendingKyc
   * ============================================================================
   * WHAT IT DOES: Retrieves paginated list of users with submitted KYC pending review
   * PARAMETERS:
   *   - page (number) : Current page number
   *   - limit (number) : Items per page
   * RETURNS: Promise<{ users, total, page, limit }>
   * ============================================================================
   */
  static async getPendingKyc(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { kycStatus: "submitted" },
        select: {
          id: true, name: true, email: true, role: true, roleSpecific: true, selfieUrl: true, registrationSubmittedAt: true, kycStatus: true, kycSubmittedAt: true,
          kycDocuments: { select: { id: true, type: true, cloudinaryUrl: true, status: true } },
        },
        orderBy: { kycSubmittedAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: { kycStatus: "submitted" } }),
    ]);
    return { users, total, page, limit };
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: approveKyc
   * ============================================================================
   * WHAT IT DOES: Approves user KYC if all required documents are present and sends email
   * PARAMETERS:
   *   - userId (string) : Target user ID
   * RETURNS: Promise<void>
   * ============================================================================
   */
  static async approveKyc(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { kycDocuments: true } });
    if (!user) throw new Error("User not found");

    const required = getRequiredDocuments(user.role, user.roleSpecific);
    const uploaded = user.kycDocuments.map((d) => d.type);
    const missing = required.filter((r) => !uploaded.includes(r));

    if (missing.length > 0) throw new Error(`MISSING_DOCS:${missing.join(",")}`);

    await prisma.kycDocument.updateMany({ where: { userId }, data: { status: "approved" } });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "approved", kycReviewedAt: new Date(), kycRejectionReason: null },
    });

    const template = kycApprovedTemplate(updatedUser.name);
    await sendEmail({ to: updatedUser.email, ...template });
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: rejectKyc
   * ============================================================================
   * WHAT IT DOES: Rejects user KYC with a mandatory reason and sends rejection email
   * PARAMETERS:
   *   - userId (string) : Target user ID
   *   - reason (string) : Human-readable rejection reason
   * RETURNS: Promise<void>
   * ============================================================================
   */
  static async rejectKyc(userId: string, reason: string) {
    if (!reason) throw new Error("REASON_REQUIRED");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "rejected", kycReviewedAt: new Date(), kycRejectionReason: reason },
    });

    const template = kycRejectedTemplate(updatedUser.name, reason);
    await sendEmail({ to: updatedUser.email, ...template });
  }
}

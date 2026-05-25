import { Request, Response, NextFunction } from "express";
import prisma from "../../../lib/prisma.js";
import sendEmail from "../../../lib/resend.js";
import {
  kycApprovedTemplate,
  kycRejectedTemplate,
} from "../../../utils/email-tempelates.js";
import { KycDocumentType } from "@prisma/client";

const requiredDocuments: Record<string, KycDocumentType[]> = {
  client: ["national_id"],
  supervisor: ["national_id", "indemnity_insurance", "certification"],
  engineer: ["national_id", "ier_license", "indemnity_insurance"],
  supplier: ["national_id", "business_registration", "tax_compliance"],
};

export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { type, cloudinaryUrl, publicId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!req.user.emailVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email first" });
    }
    if (!req.user.phoneNumberVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your phone first" });
    }

    const allowed = requiredDocuments[userRole] ?? [];
    if (!allowed.includes(type as KycDocumentType)) {
      return res.status(400).json({
        message: `Document type '${type}' is not required for your role`,
      });
    }

    const document = await prisma.kycDocument.upsert({
      where: {
        id:
          (await prisma.kycDocument.findFirst({ where: { userId, type } }))
            ?.id ?? "new",
      },
      update: { cloudinaryUrl, publicId, status: "pending" },
      create: {
        userId,
        type: type as KycDocumentType,
        cloudinaryUrl,
        publicId,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: "submitted",
        kycSubmittedAt: new Date(),
        kycRejectionReason: null,
      },
    });

    res
      .status(201)
      .json({ message: "Document uploaded successfully", document });
  } catch (error) {
    next(error);
  }
};

export const getKycStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycRejectionReason: true,
        kycDocuments: {
          select: {
            id: true,
            type: true,
            status: true,
            reviewNote: true,
            createdAt: true,
          },
        },
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const getPendingKyc = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { kycStatus: "submitted" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          kycStatus: true,
          kycSubmittedAt: true,
          kycDocuments: {
            select: {
              id: true,
              type: true,
              cloudinaryUrl: true,
              status: true,
            },
          },
        },
        orderBy: { kycSubmittedAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: { kycStatus: "submitted" } }),
    ]);

    res.json({ users, total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const approveKyc = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId.toString() },
      include: { kycDocuments: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const required = requiredDocuments[user.role] ?? [];
    const uploaded = user.kycDocuments.map((d) => d.type);
    const missing = required.filter((r) => !uploaded.includes(r));

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required documents: ${missing.join(", ")}`,
      });
    }

    await prisma.kycDocument.updateMany({
      where: { userId: userId.toString() },
      data: { status: "approved" },
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId.toString() },
      data: {
        kycStatus: "approved",
        kycReviewedAt: new Date(),
        kycRejectionReason: null,
      },
    });

    const template = kycApprovedTemplate(updatedUser.name);
    await sendEmail({ to: updatedUser.email, ...template });

    res.json({ message: "KYC approved successfully" });
  } catch (error) {
    next(error);
  }
};

export const rejectKyc = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId.toString() },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId.toString() },
      data: {
        kycStatus: "rejected",
        kycReviewedAt: new Date(),
        kycRejectionReason: reason,
      },
    });

    const template = kycRejectedTemplate(updatedUser.name, reason);
    await sendEmail({ to: updatedUser.email, ...template });

    res.json({ message: "KYC rejected successfully" });
  } catch (error) {
    next(error);
  }
};

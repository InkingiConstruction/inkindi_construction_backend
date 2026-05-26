/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : kyc.controller.ts
 * WHAT THIS FILE DOES : Receives REST API calls and coordinates KYC operations
 * HOW IT DOES IT      : Parses request parameters, delegates to KycService, and translates outcomes to JSON HTTP responses
 * DATA SOURCE         : Express Request payloads
 * DATA DESTINATION    : Express Response streams
 * PRINCIPLE APPLIED   : SOLID (Isolated HTTP delivery controller)
 * ============================================================================
 */

import { Request, Response, NextFunction } from "express";
import { KycService } from "./kyc.service";

/**
 * 🧱 CODE BLOCK: KYC HTTP Route Actions
 * WHAT IT IS DOING: Handles controller actions for KYC uploads, status checks, and admin approvals
 * WHY IT IS HERE  : Interfaces express framework pipelines directly to background logic layers
 * PRINCIPLE       : SOLID (This layer only manages web concerns)
 */

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, cloudinaryUrl, publicId } = req.body;
    
    const document = await KycService.uploadDocument(
      req.user.id,
      req.user.role,
      req.user.emailVerified,
      req.user.phoneNumberVerified,
      type,
      cloudinaryUrl,
      publicId
    );

    res.status(201).json({ message: "Document uploaded successfully", document });
  } catch (error: any) {
    if (error.message === "EMAIL_UNVERIFIED") {
      res.status(403).json({ message: "Please verify your email first" });
    } else if (error.message === "PHONE_UNVERIFIED") {
      res.status(403).json({ message: "Please verify your phone first" });
    } else if (error.message.startsWith("INVALID_DOC_TYPE:")) {
      res.status(400).json({ message: `Document type '${error.message.split(":")[1]}' is not required for your role` });
    } else {
      next(error);
    }
  }
};

export const getKycStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await KycService.getKycStatus(req.user.id);
    res.json(user);
  } catch (error: any) {
    next(error);
  }
};

export const getPendingKyc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const data = await KycService.getPendingKyc(page, limit);
    res.json(data);
  } catch (error: any) {
    next(error);
  }
};

export const approveKyc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    await KycService.approveKyc(userId);
    res.json({ message: "KYC approved successfully" });
  } catch (error: any) {
    if (error.message === "User not found") {
      res.status(404).json({ message: "User not found" });
    } else if (error.message.startsWith("MISSING_DOCS:")) {
      res.status(400).json({ message: `Missing required documents: ${error.message.split(":")[1].replace(/,/g, ", ")}` });
    } else {
      next(error);
    }
  }
};

export const rejectKyc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const { reason } = req.body;

    await KycService.rejectKyc(userId, reason);
    res.json({ message: "KYC rejected successfully" });
  } catch (error: any) {
    if (error.message === "REASON_REQUIRED") {
      res.status(400).json({ message: "Rejection reason is required" });
    } else if (error.message === "User not found") {
      res.status(404).json({ message: "User not found" });
    } else {
      next(error);
    }
  }
};

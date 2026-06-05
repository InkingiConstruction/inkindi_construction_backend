"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectKyc = exports.approveKyc = exports.getPendingKyc = exports.autoVerifyPhone = exports.getKycStatus = exports.uploadDocument = void 0;
const cloudinary_js_1 = __importDefault(require("../../../config/cloudinary.js"));
const db_js_1 = __importDefault(require("../../../config/db.js"));
const kyc_service_1 = require("./kyc.service");
/**
 * 🧱 CODE BLOCK: KYC HTTP Route Actions
 * WHAT IT IS DOING: Handles controller actions for KYC uploads, status checks, and admin approvals
 * WHY IT IS HERE  : Interfaces express framework pipelines directly to background logic layers
 * PRINCIPLE       : SOLID (This layer only manages web concerns)
 */
const uploadKycFile = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary_js_1.default.uploader.upload_stream({
        folder: "inkingi/kyc",
        resource_type: "image",
    }, (error, result) => {
        if (error || !result) {
            reject(error);
            return;
        }
        resolve(result);
    });
    stream.end(file.buffer);
});
const uploadDocument = async (req, res, next) => {
    try {
        const { type } = req.body;
        const files = req.files || [];
        const file = files[0];
        if (!file) {
            return res.status(400).json({ message: "KYC document file is required" });
        }
        const uploaded = await uploadKycFile(file);
        const document = await kyc_service_1.KycService.uploadDocument(req.user.id, req.user.role, req.user.emailVerified, Boolean(req.user.phoneNumberVerified), type, uploaded.secure_url, uploaded.public_id);
        res.status(201).json({ message: "Document uploaded successfully", document });
    }
    catch (error) {
        if (error.message === "EMAIL_UNVERIFIED") {
            res.status(403).json({ message: "Please verify your email first" });
        }
        else if (error.message === "PHONE_UNVERIFIED") {
            res.status(403).json({ message: "Please verify your phone first" });
        }
        else if (error.message.startsWith("INVALID_DOC_TYPE:")) {
            res.status(400).json({ message: `Document type '${error.message.split(":")[1]}' is not required for your role` });
        }
        else {
            next(error);
        }
    }
};
exports.uploadDocument = uploadDocument;
const getKycStatus = async (req, res, next) => {
    try {
        const user = await kyc_service_1.KycService.getKycStatus(req.user.id);
        res.json(user);
    }
    catch (error) {
        next(error);
    }
};
exports.getKycStatus = getKycStatus;
const autoVerifyPhone = async (req, res, next) => {
    try {
        const { phoneNumber } = req.body;
        const user = await db_js_1.default.user.update({
            where: { id: req.user.id },
            data: {
                phoneNumber: phoneNumber || req.user.phoneNumber,
                phoneNumberVerified: true,
            },
            select: {
                id: true,
                phoneNumber: true,
                phoneNumberVerified: true,
            },
        });
        res.json({ message: "Phone auto verified", user });
    }
    catch (error) {
        next(error);
    }
};
exports.autoVerifyPhone = autoVerifyPhone;
const getPendingKyc = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const data = await kyc_service_1.KycService.getPendingKyc(page, limit);
        res.json(data);
    }
    catch (error) {
        next(error);
    }
};
exports.getPendingKyc = getPendingKyc;
const approveKyc = async (req, res, next) => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        await kyc_service_1.KycService.approveKyc(userId);
        res.json({ message: "KYC approved successfully" });
    }
    catch (error) {
        if (error.message === "User not found") {
            res.status(404).json({ message: "User not found" });
        }
        else if (error.message.startsWith("MISSING_DOCS:")) {
            res.status(400).json({ message: `Missing required documents: ${error.message.split(":")[1].replace(/,/g, ", ")}` });
        }
        else {
            next(error);
        }
    }
};
exports.approveKyc = approveKyc;
const rejectKyc = async (req, res, next) => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        const { reason } = req.body;
        await kyc_service_1.KycService.rejectKyc(userId, reason);
        res.json({ message: "KYC rejected successfully" });
    }
    catch (error) {
        if (error.message === "REASON_REQUIRED") {
            res.status(400).json({ message: "Rejection reason is required" });
        }
        else if (error.message === "User not found") {
            res.status(404).json({ message: "User not found" });
        }
        else {
            next(error);
        }
    }
};
exports.rejectKyc = rejectKyc;

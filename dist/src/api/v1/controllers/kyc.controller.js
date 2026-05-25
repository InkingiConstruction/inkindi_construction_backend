"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkKycExpiry = exports.rejectKyc = exports.approveKyc = exports.getKycReviewByUserId = exports.getPendingKyc = exports.getKycStatus = exports.uploadDocument = void 0;
const client_1 = require("@prisma/client");
const cloudinary_js_1 = __importDefault(require("../../../lib/cloudinary.js"));
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const resend_js_1 = __importDefault(require("../../../lib/resend.js"));
const email_tempelates_js_1 = require("../../../utils/email-tempelates.js");
const notifications_js_1 = require("../../../lib/notifications.js");
const requiredDocuments = {
    client: ["national_id"],
    supervisor: ["national_id", "indemnity_insurance", "certification"],
    engineer: ["national_id", "ier_license", "indemnity_insurance"],
    supplier: ["national_id", "business_registration", "tax_compliance"],
};
const documentLabels = {
    national_id: "National ID or Passport",
    passport: "Passport",
    ier_license: "IER License",
    indemnity_insurance: "Professional Indemnity Insurance",
    business_registration: "Business Registration Certificate",
    tax_compliance: "Tax Compliance Certificate",
    certification: "Professional Certification",
};
const kycExpiryDays = Number(process.env.KYC_EXPIRY_DAYS || 365);
const isKycDocumentType = (value) => typeof value === "string" &&
    Object.values(client_1.KycDocumentType).includes(value);
const getAllowedDocuments = (role) => requiredDocuments[role] || [];
const uploadKycFile = (file, userId, type) => new Promise((resolve, reject) => {
    const stream = cloudinary_js_1.default.uploader.upload_stream({
        folder: `inkingi/kyc/${userId}/${type}`,
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
const getUploadedFile = (req) => {
    const files = req.files || [];
    return files[0];
};
const getKycCompleteness = (role, documents) => {
    const required = getAllowedDocuments(role);
    const uploaded = documents.map((document) => document.type);
    const approved = documents
        .filter((document) => document.status === "approved")
        .map((document) => document.type);
    return {
        required,
        missing: required.filter((type) => !uploaded.includes(type)),
        pending: documents
            .filter((document) => document.status === "pending")
            .map((document) => document.type),
        rejected: documents
            .filter((document) => document.status === "rejected")
            .map((document) => document.type),
        approved,
        isComplete: required.every((type) => uploaded.includes(type)),
        isApproved: required.every((type) => approved.includes(type)),
    };
};
const buildKycUserPayload = (user) => ({
    requiredDocuments: getAllowedDocuments(user.role).map((type) => ({
        type,
        label: documentLabels[type],
    })),
    completeness: getKycCompleteness(user.role, user.kycDocuments),
});
const uploadDocument = async (req, res, next) => {
    try {
        const { type } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        const file = getUploadedFile(req);
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
        if (!isKycDocumentType(type)) {
            return res.status(400).json({ message: "Invalid KYC document type" });
        }
        const allowed = getAllowedDocuments(userRole);
        if (!allowed.includes(type)) {
            return res.status(400).json({
                message: `${documentLabels[type]} is not required for ${userRole}`,
                allowedDocuments: allowed.map((documentType) => ({
                    type: documentType,
                    label: documentLabels[documentType],
                })),
            });
        }
        if (!file) {
            return res.status(400).json({ message: "KYC document file is required" });
        }
        const upload = await uploadKycFile(file, userId, type);
        const document = await prisma_js_1.default.kycDocument.upsert({
            where: {
                userId_type: {
                    userId,
                    type,
                },
            },
            update: {
                cloudinaryUrl: upload.secure_url,
                publicId: upload.public_id,
                status: "pending",
                reviewNote: null,
            },
            create: {
                userId,
                type,
                cloudinaryUrl: upload.secure_url,
                publicId: upload.public_id,
            },
        });
        const userDocuments = await prisma_js_1.default.kycDocument.findMany({
            where: { userId },
            select: {
                type: true,
                status: true,
            },
        });
        const completeness = getKycCompleteness(userRole, userDocuments);
        await prisma_js_1.default.user.update({
            where: { id: userId },
            data: {
                kycStatus: completeness.isComplete ? "submitted" : "not_submitted",
                kycSubmittedAt: completeness.isComplete ? new Date() : null,
                kycRejectionReason: null,
            },
        });
        return res.status(201).json({
            message: "KYC document uploaded successfully",
            document,
            completeness,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadDocument = uploadDocument;
const getKycStatus = async (req, res, next) => {
    try {
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                kycStatus: true,
                kycSubmittedAt: true,
                kycReviewedAt: true,
                kycRejectionReason: true,
                kycDocuments: {
                    select: {
                        id: true,
                        type: true,
                        cloudinaryUrl: true,
                        status: true,
                        reviewNote: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json({
            ...user,
            ...buildKycUserPayload(user),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getKycStatus = getKycStatus;
const getPendingKyc = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const status = typeof req.query.status === "string"
            ? req.query.status
            : "submitted";
        if (!Object.values(client_1.KycStatus).includes(status)) {
            return res.status(400).json({ message: "Invalid KYC status" });
        }
        const [users, total] = await Promise.all([
            prisma_js_1.default.user.findMany({
                where: { kycStatus: status },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    phoneNumber: true,
                    kycStatus: true,
                    kycSubmittedAt: true,
                    kycReviewedAt: true,
                    kycRejectionReason: true,
                    kycDocuments: {
                        select: {
                            id: true,
                            type: true,
                            cloudinaryUrl: true,
                            publicId: true,
                            status: true,
                            reviewNote: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
                orderBy: { kycSubmittedAt: "asc" },
                skip,
                take: limit,
            }),
            prisma_js_1.default.user.count({ where: { kycStatus: status } }),
        ]);
        return res.json({
            users: users.map((user) => ({
                ...user,
                ...buildKycUserPayload(user),
            })),
            total,
            page,
            limit,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPendingKyc = getPendingKyc;
const getKycReviewByUserId = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: String(userId) },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phoneNumber: true,
                kycStatus: true,
                kycSubmittedAt: true,
                kycReviewedAt: true,
                kycRejectionReason: true,
                kycDocuments: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json({
            ...user,
            ...buildKycUserPayload(user),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getKycReviewByUserId = getKycReviewByUserId;
const approveKyc = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { reviewNote } = req.body;
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: String(userId) },
            include: { kycDocuments: true },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const completeness = getKycCompleteness(user.role, user.kycDocuments);
        if (!completeness.isComplete) {
            return res.status(400).json({
                message: "Missing required KYC documents",
                missing: completeness.missing,
            });
        }
        await prisma_js_1.default.kycDocument.updateMany({
            where: {
                userId: String(userId),
                type: { in: completeness.required },
            },
            data: {
                status: "approved",
                reviewNote: reviewNote || null,
            },
        });
        const updatedUser = await prisma_js_1.default.user.update({
            where: { id: String(userId) },
            data: {
                kycStatus: "approved",
                kycReviewedAt: new Date(),
                kycRejectionReason: null,
            },
        });
        const template = (0, email_tempelates_js_1.kycApprovedTemplate)(updatedUser.name);
        await (0, resend_js_1.default)({ to: updatedUser.email, ...template });
        await (0, notifications_js_1.notifyUser)({
            userId: updatedUser.id,
            title: "KYC approved",
            body: "Your identity verification was approved",
            data: { type: "kyc_approved" },
        });
        return res.json({ message: "KYC approved successfully" });
    }
    catch (error) {
        next(error);
    }
};
exports.approveKyc = approveKyc;
const rejectKyc = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { reason, documentIds } = req.body;
        if (!reason) {
            return res.status(400).json({ message: "Rejection reason is required" });
        }
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: String(userId) },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await prisma_js_1.default.kycDocument.updateMany({
            where: {
                userId: String(userId),
                ...(Array.isArray(documentIds) && documentIds.length > 0
                    ? { id: { in: documentIds.map(String) } }
                    : {}),
            },
            data: {
                status: "rejected",
                reviewNote: reason,
            },
        });
        const updatedUser = await prisma_js_1.default.user.update({
            where: { id: String(userId) },
            data: {
                kycStatus: "rejected",
                kycReviewedAt: new Date(),
                kycRejectionReason: reason,
            },
        });
        const template = (0, email_tempelates_js_1.kycRejectedTemplate)(updatedUser.name, reason);
        await (0, resend_js_1.default)({ to: updatedUser.email, ...template });
        await (0, notifications_js_1.notifyUser)({
            userId: updatedUser.id,
            title: "KYC rejected",
            body: reason,
            data: { type: "kyc_rejected" },
        });
        return res.json({ message: "KYC rejected successfully" });
    }
    catch (error) {
        next(error);
    }
};
exports.rejectKyc = rejectKyc;
const checkKycExpiry = async (_req, res, next) => {
    try {
        const expiresBefore = new Date(Date.now() - kycExpiryDays * 24 * 60 * 60 * 1000);
        const expiredUsers = await prisma_js_1.default.user.findMany({
            where: {
                kycStatus: "approved",
                kycReviewedAt: {
                    lt: expiresBefore,
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                kycReviewedAt: true,
            },
        });
        if (expiredUsers.length > 0) {
            await prisma_js_1.default.user.updateMany({
                where: {
                    id: { in: expiredUsers.map((user) => user.id) },
                },
                data: {
                    kycStatus: "additional_info_requested",
                    kycRejectionReason: "KYC documents expired. Please upload updated documents.",
                },
            });
            await prisma_js_1.default.kycDocument.updateMany({
                where: {
                    userId: { in: expiredUsers.map((user) => user.id) },
                },
                data: {
                    status: "pending",
                    reviewNote: "Expired document. Please upload updated document.",
                },
            });
        }
        return res.json({
            message: "KYC expiry check completed",
            expiryDays: kycExpiryDays,
            expiredCount: expiredUsers.length,
            expiredUsers,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.checkKycExpiry = checkKycExpiry;

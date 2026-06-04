"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVerification = exports.updateVerification = exports.getVerificationById = exports.getVerifications = exports.createVerification = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getId = (id) => Array.isArray(id) ? id[0] : id;
const createVerification = async (req, res) => {
    try {
        const { id, identifier, value, expiresAt } = req.body;
        if (!identifier || !value || !expiresAt) {
            return res.status(400).json({
                message: "identifier, value and expiresAt are required",
            });
        }
        const verification = await prisma_js_1.default.verification.create({
            data: {
                id: id || crypto_1.default.randomUUID(),
                identifier,
                value,
                expiresAt: new Date(expiresAt),
            },
        });
        return res.status(201).json({
            message: "Verification created successfully",
            verification,
        });
    }
    catch (error) {
        console.error("Create verification error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createVerification = createVerification;
const getVerifications = async (req, res) => {
    try {
        const identifier = typeof req.query.identifier === "string"
            ? req.query.identifier
            : undefined;
        const verifications = await prisma_js_1.default.verification.findMany({
            where: { ...(identifier ? { identifier } : {}) },
            orderBy: { createdAt: "desc" },
        });
        return res.json(verifications);
    }
    catch (error) {
        console.error("Get verifications error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getVerifications = getVerifications;
const getVerificationById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Verification ID is required" });
        }
        const verification = await prisma_js_1.default.verification.findUnique({
            where: { id },
        });
        if (!verification) {
            return res.status(404).json({ message: "Verification not found" });
        }
        return res.json(verification);
    }
    catch (error) {
        console.error("Get verification by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getVerificationById = getVerificationById;
const updateVerification = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { identifier, value, expiresAt } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Verification ID is required" });
        }
        const verification = await prisma_js_1.default.verification.update({
            where: { id },
            data: {
                identifier,
                value,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            },
        });
        return res.json({
            message: "Verification updated successfully",
            verification,
        });
    }
    catch (error) {
        console.error("Update verification error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateVerification = updateVerification;
const deleteVerification = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Verification ID is required" });
        }
        await prisma_js_1.default.verification.delete({ where: { id } });
        return res.json({ message: "Verification deleted successfully" });
    }
    catch (error) {
        console.error("Delete verification error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteVerification = deleteVerification;

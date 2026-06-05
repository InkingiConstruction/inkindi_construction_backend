"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteApiKey = exports.updateApiKey = exports.getApiKeyById = exports.getApiKeys = exports.createApiKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getId = (id) => Array.isArray(id) ? id[0] : id;
const parseJson = (value) => {
    if (!value)
        return undefined;
    if (typeof value !== "string")
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
};
const hashKey = (key) => crypto_1.default.createHash("sha256").update(key).digest("hex");
const sanitizeApiKey = (apiKey) => {
    const { keyHash, ...safeApiKey } = apiKey;
    return safeApiKey;
};
const createApiKey = async (req, res) => {
    try {
        const { name, permissions, expiresAt, userId } = req.body;
        if (!name) {
            return res.status(400).json({ message: "name is required" });
        }
        const rawKey = `ik_${crypto_1.default.randomBytes(32).toString("hex")}`;
        const apiKey = await prisma_js_1.default.apiKey.create({
            data: {
                userId: req.user.role === "admin" && userId ? userId : req.user.id,
                name,
                keyHash: hashKey(rawKey),
                prefix: rawKey.slice(0, 12),
                permissions: parseJson(permissions) || [],
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            },
            include: { user: true },
        });
        return res.status(201).json({
            message: "API key created successfully",
            apiKey: sanitizeApiKey(apiKey),
            key: rawKey,
        });
    }
    catch (error) {
        console.error("Create API key error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createApiKey = createApiKey;
const getApiKeys = async (req, res) => {
    try {
        const userId = typeof req.query.userId === "string" && req.user.role === "admin"
            ? req.query.userId
            : req.user.id;
        const apiKeys = await prisma_js_1.default.apiKey.findMany({
            where: { userId },
            include: { user: true },
            orderBy: { createdAt: "desc" },
        });
        return res.json(apiKeys.map(sanitizeApiKey));
    }
    catch (error) {
        console.error("Get API keys error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getApiKeys = getApiKeys;
const getApiKeyById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "API key ID is required" });
        }
        const apiKey = await prisma_js_1.default.apiKey.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!apiKey) {
            return res.status(404).json({ message: "API key not found" });
        }
        if (req.user.role !== "admin" && apiKey.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(sanitizeApiKey(apiKey));
    }
    catch (error) {
        console.error("Get API key by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getApiKeyById = getApiKeyById;
const updateApiKey = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { name, permissions, expiresAt, revokedAt } = req.body;
        if (!id) {
            return res.status(400).json({ message: "API key ID is required" });
        }
        const existing = await prisma_js_1.default.apiKey.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "API key not found" });
        }
        if (req.user.role !== "admin" && existing.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const apiKey = await prisma_js_1.default.apiKey.update({
            where: { id },
            data: {
                name,
                permissions: permissions !== undefined ? parseJson(permissions) : undefined,
                expiresAt: expiresAt !== undefined
                    ? expiresAt
                        ? new Date(expiresAt)
                        : null
                    : undefined,
                revokedAt: revokedAt !== undefined
                    ? revokedAt
                        ? new Date(revokedAt)
                        : null
                    : undefined,
            },
            include: { user: true },
        });
        return res.json({
            message: "API key updated successfully",
            apiKey: sanitizeApiKey(apiKey),
        });
    }
    catch (error) {
        console.error("Update API key error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateApiKey = updateApiKey;
const deleteApiKey = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "API key ID is required" });
        }
        const existing = await prisma_js_1.default.apiKey.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "API key not found" });
        }
        if (req.user.role !== "admin" && existing.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await prisma_js_1.default.apiKey.delete({ where: { id } });
        return res.json({ message: "API key deleted successfully" });
    }
    catch (error) {
        console.error("Delete API key error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteApiKey = deleteApiKey;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.updateAccount = exports.getAccountById = exports.getAccounts = exports.createAccount = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getId = (id) => Array.isArray(id) ? id[0] : id;
const sanitizeAccount = (account) => {
    const { password, ...safeAccount } = account;
    return safeAccount;
};
const createAccount = async (req, res) => {
    try {
        const { id, accountId, providerId, userId, accessToken, refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, } = req.body;
        if (!accountId || !providerId || !userId) {
            return res.status(400).json({
                message: "accountId, providerId and userId are required",
            });
        }
        const account = await prisma_js_1.default.account.create({
            data: {
                id: id || crypto_1.default.randomUUID(),
                accountId,
                providerId,
                userId,
                accessToken,
                refreshToken,
                idToken,
                accessTokenExpiresAt: accessTokenExpiresAt
                    ? new Date(accessTokenExpiresAt)
                    : undefined,
                refreshTokenExpiresAt: refreshTokenExpiresAt
                    ? new Date(refreshTokenExpiresAt)
                    : undefined,
                scope,
                password,
            },
            include: { user: true },
        });
        return res.status(201).json({
            message: "Account created successfully",
            account: sanitizeAccount(account),
        });
    }
    catch (error) {
        console.error("Create account error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createAccount = createAccount;
const getAccounts = async (req, res) => {
    try {
        const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
        const accounts = await prisma_js_1.default.account.findMany({
            where: { ...(userId ? { userId } : {}) },
            include: { user: true },
            orderBy: { createdAt: "desc" },
        });
        return res.json(accounts.map(sanitizeAccount));
    }
    catch (error) {
        console.error("Get accounts error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getAccounts = getAccounts;
const getAccountById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Account ID is required" });
        }
        const account = await prisma_js_1.default.account.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!account) {
            return res.status(404).json({ message: "Account not found" });
        }
        return res.json(sanitizeAccount(account));
    }
    catch (error) {
        console.error("Get account by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getAccountById = getAccountById;
const updateAccount = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { accessToken, refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Account ID is required" });
        }
        const account = await prisma_js_1.default.account.update({
            where: { id },
            data: {
                accessToken,
                refreshToken,
                idToken,
                accessTokenExpiresAt: accessTokenExpiresAt !== undefined
                    ? accessTokenExpiresAt
                        ? new Date(accessTokenExpiresAt)
                        : null
                    : undefined,
                refreshTokenExpiresAt: refreshTokenExpiresAt !== undefined
                    ? refreshTokenExpiresAt
                        ? new Date(refreshTokenExpiresAt)
                        : null
                    : undefined,
                scope,
                password,
            },
            include: { user: true },
        });
        return res.json({
            message: "Account updated successfully",
            account: sanitizeAccount(account),
        });
    }
    catch (error) {
        console.error("Update account error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateAccount = updateAccount;
const deleteAccount = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Account ID is required" });
        }
        await prisma_js_1.default.account.delete({ where: { id } });
        return res.json({ message: "Account deleted successfully" });
    }
    catch (error) {
        console.error("Delete account error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteAccount = deleteAccount;

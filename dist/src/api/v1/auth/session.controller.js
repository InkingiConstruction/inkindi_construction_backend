"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSession = exports.updateSession = exports.getSessionById = exports.getSessions = exports.createSession = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getId = (id) => Array.isArray(id) ? id[0] : id;
const createSession = async (req, res) => {
    try {
        const { id, token, userId, expiresAt, ipAddress, userAgent, impersonatedBy } = req.body;
        if (!userId || !expiresAt) {
            return res.status(400).json({ message: "userId and expiresAt are required" });
        }
        const session = await prisma_js_1.default.session.create({
            data: {
                id: id || crypto_1.default.randomUUID(),
                token: token || crypto_1.default.randomBytes(32).toString("hex"),
                userId,
                expiresAt: new Date(expiresAt),
                ipAddress,
                userAgent,
                impersonatedBy,
            },
            include: { user: true },
        });
        return res.status(201).json({
            message: "Session created successfully",
            session,
        });
    }
    catch (error) {
        console.error("Create session error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createSession = createSession;
const getSessions = async (req, res) => {
    try {
        const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
        const sessions = await prisma_js_1.default.session.findMany({
            where: { ...(userId ? { userId } : {}) },
            include: { user: true },
            orderBy: { createdAt: "desc" },
        });
        return res.json(sessions);
    }
    catch (error) {
        console.error("Get sessions error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getSessions = getSessions;
const getSessionById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Session ID is required" });
        }
        const session = await prisma_js_1.default.session.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        return res.json(session);
    }
    catch (error) {
        console.error("Get session by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getSessionById = getSessionById;
const updateSession = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { expiresAt, ipAddress, userAgent, impersonatedBy } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Session ID is required" });
        }
        const session = await prisma_js_1.default.session.update({
            where: { id },
            data: {
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                ipAddress,
                userAgent,
                impersonatedBy,
            },
            include: { user: true },
        });
        return res.json({
            message: "Session updated successfully",
            session,
        });
    }
    catch (error) {
        console.error("Update session error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateSession = updateSession;
const deleteSession = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Session ID is required" });
        }
        await prisma_js_1.default.session.delete({ where: { id } });
        return res.json({ message: "Session deleted successfully" });
    }
    catch (error) {
        console.error("Delete session error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteSession = deleteSession;

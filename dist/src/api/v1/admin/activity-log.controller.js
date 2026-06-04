"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteActivityLog = exports.updateActivityLog = exports.getActivityLogById = exports.getActivityLogs = exports.createActivityLog = void 0;
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
const createActivityLog = async (req, res) => {
    try {
        const { userId, action, metadata } = req.body;
        if (!action) {
            return res.status(400).json({ message: "action is required" });
        }
        const activityLog = await prisma_js_1.default.activityLog.create({
            data: {
                userId: req.user.role === "admin" && userId ? userId : req.user.id,
                action,
                metadata: parseJson(metadata),
                ipAddress: req.ip,
            },
            include: { user: true },
        });
        return res.status(201).json({
            message: "Activity log created successfully",
            activityLog,
        });
    }
    catch (error) {
        console.error("Create activity log error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createActivityLog = createActivityLog;
const getActivityLogs = async (req, res) => {
    try {
        const userId = typeof req.query.userId === "string" && req.user.role === "admin"
            ? req.query.userId
            : req.user.id;
        const activityLogs = await prisma_js_1.default.activityLog.findMany({
            where: { userId },
            include: { user: true },
            orderBy: { createdAt: "desc" },
        });
        return res.json(activityLogs);
    }
    catch (error) {
        console.error("Get activity logs error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getActivityLogs = getActivityLogs;
const getActivityLogById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Activity log ID is required" });
        }
        const activityLog = await prisma_js_1.default.activityLog.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!activityLog) {
            return res.status(404).json({ message: "Activity log not found" });
        }
        if (req.user.role !== "admin" && activityLog.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(activityLog);
    }
    catch (error) {
        console.error("Get activity log by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getActivityLogById = getActivityLogById;
const updateActivityLog = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { action, metadata } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Activity log ID is required" });
        }
        const activityLog = await prisma_js_1.default.activityLog.update({
            where: { id },
            data: {
                action,
                metadata: metadata !== undefined ? parseJson(metadata) : undefined,
            },
            include: { user: true },
        });
        return res.json({
            message: "Activity log updated successfully",
            activityLog,
        });
    }
    catch (error) {
        console.error("Update activity log error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateActivityLog = updateActivityLog;
const deleteActivityLog = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Activity log ID is required" });
        }
        await prisma_js_1.default.activityLog.delete({ where: { id } });
        return res.json({ message: "Activity log deleted successfully" });
    }
    catch (error) {
        console.error("Delete activity log error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteActivityLog = deleteActivityLog;

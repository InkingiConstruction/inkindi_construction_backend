"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAuditLog = exports.updateAuditLog = exports.getAuditLogById = exports.getAuditLogs = exports.createAuditLog = void 0;
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
const createAuditLog = async (req, res) => {
    try {
        const { actorId, action, entityType, entityId, oldValues, newValues, result, projectId, } = req.body;
        if (!action || !entityType || !result) {
            return res.status(400).json({
                message: "action, entityType and result are required",
            });
        }
        const auditLog = await prisma_js_1.default.auditLog.create({
            data: {
                actorId: actorId || req.user.id,
                action,
                entityType,
                entityId,
                oldValues: parseJson(oldValues),
                newValues: parseJson(newValues),
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
                result,
                projectId,
            },
            include: { actor: true, project: true },
        });
        return res.status(201).json({
            message: "Audit log created successfully",
            auditLog,
        });
    }
    catch (error) {
        console.error("Create audit log error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createAuditLog = createAuditLog;
const getAuditLogs = async (req, res) => {
    try {
        const actorId = typeof req.query.actorId === "string" ? req.query.actorId : undefined;
        const entityType = typeof req.query.entityType === "string"
            ? req.query.entityType
            : undefined;
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const auditLogs = await prisma_js_1.default.auditLog.findMany({
            where: {
                ...(actorId ? { actorId } : {}),
                ...(entityType ? { entityType } : {}),
                ...(projectId ? { projectId } : {}),
            },
            include: { actor: true, project: true },
            orderBy: { createdAt: "desc" },
        });
        return res.json(auditLogs);
    }
    catch (error) {
        console.error("Get audit logs error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getAuditLogs = getAuditLogs;
const getAuditLogById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Audit log ID is required" });
        }
        const auditLog = await prisma_js_1.default.auditLog.findUnique({
            where: { id },
            include: { actor: true, project: true },
        });
        if (!auditLog) {
            return res.status(404).json({ message: "Audit log not found" });
        }
        return res.json(auditLog);
    }
    catch (error) {
        console.error("Get audit log by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getAuditLogById = getAuditLogById;
const updateAuditLog = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { result, oldValues, newValues } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Audit log ID is required" });
        }
        const auditLog = await prisma_js_1.default.auditLog.update({
            where: { id },
            data: {
                result,
                oldValues: oldValues !== undefined ? parseJson(oldValues) : undefined,
                newValues: newValues !== undefined ? parseJson(newValues) : undefined,
            },
            include: { actor: true, project: true },
        });
        return res.json({
            message: "Audit log updated successfully",
            auditLog,
        });
    }
    catch (error) {
        console.error("Update audit log error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateAuditLog = updateAuditLog;
const deleteAuditLog = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Audit log ID is required" });
        }
        await prisma_js_1.default.auditLog.delete({ where: { id } });
        return res.json({ message: "Audit log deleted successfully" });
    }
    catch (error) {
        console.error("Delete audit log error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteAuditLog = deleteAuditLog;

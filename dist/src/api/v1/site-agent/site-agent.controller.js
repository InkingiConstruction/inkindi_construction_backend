"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeliveryVerification = exports.listDeliveryVerifications = exports.createInventoryLog = exports.listInventoryLogs = exports.createDailyReport = exports.listDailyReports = void 0;
const db_js_1 = __importDefault(require("../../../config/db.js"));
const parseJson = (value, fallback = []) => {
    if (value === undefined || value === null || value === "")
        return fallback;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            return fallback;
        }
    }
    return value;
};
const ensureProjectAccess = async (projectId, userId, role) => {
    if (role === "admin")
        return true;
    const project = await db_js_1.default.project.findFirst({
        where: {
            id: projectId,
            OR: [
                { clientId: userId },
                { engineerId: userId },
                {
                    projectMembers: {
                        some: {
                            userId,
                            status: "accepted",
                        },
                    },
                },
            ],
        },
        select: { id: true },
    });
    return Boolean(project);
};
const listDailyReports = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const reports = await db_js_1.default.siteDailyReport.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(req.user.role === "site_agent" ? { siteAgentId: req.user.id } : {}),
            },
            include: {
                project: { select: { id: true, name: true, status: true } },
                siteAgent: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return res.json(reports);
    }
    catch (error) {
        console.error("List site daily reports error:", error);
        return res.status(500).json({ message: "Failed to load daily reports" });
    }
};
exports.listDailyReports = listDailyReports;
const createDailyReport = async (req, res) => {
    try {
        const projectId = String(req.body.projectId || "");
        const weather = String(req.body.weather || "").trim();
        const workforceCount = Number(req.body.workforceCount);
        const taskProgress = String(req.body.taskProgress || "").trim();
        const notes = req.body.notes ? String(req.body.notes).trim() : undefined;
        if (!projectId || !weather || !Number.isFinite(workforceCount) || workforceCount < 0 || !taskProgress) {
            return res.status(400).json({ message: "projectId, weather, workforceCount and taskProgress are required" });
        }
        const hasAccess = await ensureProjectAccess(projectId, req.user.id, req.user.role);
        if (!hasAccess) {
            return res.status(403).json({ message: "You are not assigned to this project" });
        }
        const report = await db_js_1.default.siteDailyReport.create({
            data: {
                projectId,
                siteAgentId: req.user.id,
                weather,
                workforceCount,
                taskProgress,
                notes,
                evidence: parseJson(req.body.evidence),
            },
            include: {
                project: { select: { id: true, name: true, status: true } },
            },
        });
        return res.status(201).json(report);
    }
    catch (error) {
        console.error("Create site daily report error:", error);
        return res.status(500).json({ message: "Failed to create daily report" });
    }
};
exports.createDailyReport = createDailyReport;
const listInventoryLogs = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const logs = await db_js_1.default.siteInventoryLog.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(req.user.role === "site_agent" ? { siteAgentId: req.user.id } : {}),
            },
            include: {
                project: { select: { id: true, name: true, status: true } },
                siteAgent: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return res.json(logs);
    }
    catch (error) {
        console.error("List site inventory logs error:", error);
        return res.status(500).json({ message: "Failed to load inventory logs" });
    }
};
exports.listInventoryLogs = listInventoryLogs;
const createInventoryLog = async (req, res) => {
    try {
        const projectId = String(req.body.projectId || "");
        const material = String(req.body.material || "").trim();
        const quantity = Number(req.body.quantity);
        const unit = req.body.unit ? String(req.body.unit).trim() : undefined;
        const direction = req.body.direction ? String(req.body.direction).trim() : "consumed";
        const notes = req.body.notes ? String(req.body.notes).trim() : undefined;
        if (!projectId || !material || !Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ message: "projectId, material and positive quantity are required" });
        }
        const hasAccess = await ensureProjectAccess(projectId, req.user.id, req.user.role);
        if (!hasAccess) {
            return res.status(403).json({ message: "You are not assigned to this project" });
        }
        const log = await db_js_1.default.siteInventoryLog.create({
            data: {
                projectId,
                siteAgentId: req.user.id,
                material,
                unit,
                quantity,
                direction,
                notes,
            },
            include: {
                project: { select: { id: true, name: true, status: true } },
            },
        });
        return res.status(201).json(log);
    }
    catch (error) {
        console.error("Create site inventory log error:", error);
        return res.status(500).json({ message: "Failed to create inventory log" });
    }
};
exports.createInventoryLog = createInventoryLog;
const listDeliveryVerifications = async (req, res) => {
    try {
        const records = await db_js_1.default.deliveryVerification.findMany({
            where: {
                ...(req.user.role === "site_agent" ? { siteAgentId: req.user.id } : {}),
            },
            include: {
                project: { select: { id: true, name: true, status: true } },
                delivery: { select: { id: true, status: true, purchaseOrderId: true } },
                siteAgent: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return res.json(records);
    }
    catch (error) {
        console.error("List delivery verifications error:", error);
        return res.status(500).json({ message: "Failed to load delivery verifications" });
    }
};
exports.listDeliveryVerifications = listDeliveryVerifications;
const createDeliveryVerification = async (req, res) => {
    try {
        const projectId = String(req.body.projectId || "");
        const deliveryId = req.body.deliveryId ? String(req.body.deliveryId) : undefined;
        const deliveryCode = String(req.body.deliveryCode || "").trim();
        const pin = String(req.body.pin || "").trim();
        const remarks = req.body.remarks ? String(req.body.remarks).trim() : undefined;
        if (!projectId || !deliveryCode || !/^\d{6}$/.test(pin)) {
            return res.status(400).json({ message: "projectId, deliveryCode and 6-digit PIN are required" });
        }
        const hasAccess = await ensureProjectAccess(projectId, req.user.id, req.user.role);
        if (!hasAccess) {
            return res.status(403).json({ message: "You are not assigned to this project" });
        }
        const verification = await db_js_1.default.deliveryVerification.create({
            data: {
                projectId,
                deliveryId,
                siteAgentId: req.user.id,
                deliveryCode,
                pin,
                remarks,
                receiptPhotos: parseJson(req.body.receiptPhotos),
            },
            include: {
                project: { select: { id: true, name: true, status: true } },
                delivery: { select: { id: true, status: true, purchaseOrderId: true } },
            },
        });
        return res.status(201).json(verification);
    }
    catch (error) {
        console.error("Create delivery verification error:", error);
        return res.status(500).json({ message: "Failed to verify delivery" });
    }
};
exports.createDeliveryVerification = createDeliveryVerification;

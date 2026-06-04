"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSystemSetting = exports.updateSystemSetting = exports.getSystemSettingById = exports.getSystemSettings = exports.createSystemSetting = void 0;
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getId = (id) => Array.isArray(id) ? id[0] : id;
const parseJson = (value) => {
    if (value === undefined)
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
const createSystemSetting = async (req, res) => {
    try {
        const { key, value, description } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ message: "key and value are required" });
        }
        const systemSetting = await prisma_js_1.default.systemSetting.create({
            data: {
                key,
                value: parseJson(value) ?? {},
                description,
                updatedBy: req.user.id,
            },
        });
        return res.status(201).json({
            message: "System setting created successfully",
            systemSetting,
        });
    }
    catch (error) {
        console.error("Create system setting error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createSystemSetting = createSystemSetting;
const getSystemSettings = async (_req, res) => {
    try {
        const systemSettings = await prisma_js_1.default.systemSetting.findMany({
            orderBy: { key: "asc" },
        });
        return res.json(systemSettings);
    }
    catch (error) {
        console.error("Get system settings error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getSystemSettings = getSystemSettings;
const getSystemSettingById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "System setting ID is required" });
        }
        const systemSetting = await prisma_js_1.default.systemSetting.findUnique({
            where: { id },
        });
        if (!systemSetting) {
            return res.status(404).json({ message: "System setting not found" });
        }
        return res.json(systemSetting);
    }
    catch (error) {
        console.error("Get system setting by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getSystemSettingById = getSystemSettingById;
const updateSystemSetting = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { key, value, description } = req.body;
        if (!id) {
            return res.status(400).json({ message: "System setting ID is required" });
        }
        const systemSetting = await prisma_js_1.default.systemSetting.update({
            where: { id },
            data: {
                key,
                value: value !== undefined ? parseJson(value) : undefined,
                description,
                updatedBy: req.user.id,
            },
        });
        return res.json({
            message: "System setting updated successfully",
            systemSetting,
        });
    }
    catch (error) {
        console.error("Update system setting error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateSystemSetting = updateSystemSetting;
const deleteSystemSetting = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "System setting ID is required" });
        }
        await prisma_js_1.default.systemSetting.delete({ where: { id } });
        return res.json({ message: "System setting deleted successfully" });
    }
    catch (error) {
        console.error("Delete system setting error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteSystemSetting = deleteSystemSetting;

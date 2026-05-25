"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmailTemplate = exports.updateEmailTemplate = exports.getEmailTemplateById = exports.getEmailTemplates = exports.createEmailTemplate = void 0;
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getId = (id) => Array.isArray(id) ? id[0] : id;
const createEmailTemplate = async (req, res) => {
    try {
        const { name, subject, htmlContent, plainText } = req.body;
        if (!name || !subject || !htmlContent) {
            return res.status(400).json({
                message: "name, subject and htmlContent are required",
            });
        }
        const emailTemplate = await prisma_js_1.default.emailTemplate.create({
            data: { name, subject, htmlContent, plainText },
        });
        return res.status(201).json({
            message: "Email template created successfully",
            emailTemplate,
        });
    }
    catch (error) {
        console.error("Create email template error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createEmailTemplate = createEmailTemplate;
const getEmailTemplates = async (_req, res) => {
    try {
        const emailTemplates = await prisma_js_1.default.emailTemplate.findMany({
            orderBy: { name: "asc" },
        });
        return res.json(emailTemplates);
    }
    catch (error) {
        console.error("Get email templates error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getEmailTemplates = getEmailTemplates;
const getEmailTemplateById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Email template ID is required" });
        }
        const emailTemplate = await prisma_js_1.default.emailTemplate.findUnique({
            where: { id },
        });
        if (!emailTemplate) {
            return res.status(404).json({ message: "Email template not found" });
        }
        return res.json(emailTemplate);
    }
    catch (error) {
        console.error("Get email template by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getEmailTemplateById = getEmailTemplateById;
const updateEmailTemplate = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { name, subject, htmlContent, plainText } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Email template ID is required" });
        }
        const emailTemplate = await prisma_js_1.default.emailTemplate.update({
            where: { id },
            data: { name, subject, htmlContent, plainText },
        });
        return res.json({
            message: "Email template updated successfully",
            emailTemplate,
        });
    }
    catch (error) {
        console.error("Update email template error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateEmailTemplate = updateEmailTemplate;
const deleteEmailTemplate = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Email template ID is required" });
        }
        await prisma_js_1.default.emailTemplate.delete({ where: { id } });
        return res.json({ message: "Email template deleted successfully" });
    }
    catch (error) {
        console.error("Delete email template error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteEmailTemplate = deleteEmailTemplate;

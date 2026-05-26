"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessage = exports.updateMessage = exports.getMessageById = exports.getMessages = exports.createMessage = void 0;
const cloudinary_js_1 = __importDefault(require("../../../lib/cloudinary.js"));
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const notifications_js_1 = require("../../../lib/notifications.js");
const getId = (id) => Array.isArray(id) ? id[0] : id;
const uploadImage = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary_js_1.default.uploader.upload_stream({
        folder: "inkingi/messages",
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
const canAccessProject = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const createMessage = async (req, res) => {
    try {
        const { projectId, content, photoUrl } = req.body;
        const files = req.files || [];
        if (!projectId || !content) {
            return res.status(400).json({
                message: "projectId and content are required",
            });
        }
        const project = await prisma_js_1.default.project.findUnique({
            where: { id: String(projectId) },
            include: { projectMembers: true },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canAccessProject(project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const upload = files[0] ? await uploadImage(files[0]) : null;
        const message = await prisma_js_1.default.message.create({
            data: {
                projectId: project.id,
                senderId: req.user.id,
                content,
                photoUrl: upload?.secure_url || photoUrl,
            },
            include: {
                project: true,
                sender: {
                    select: { id: true, name: true, email: true, role: true, image: true },
                },
            },
        });
        await (0, notifications_js_1.notifyProjectParticipants)({
            projectId: message.projectId,
            excludeUserId: req.user.id,
            title: "New project message",
            body: `${message.sender.name}: ${message.content}`,
            data: {
                messageId: message.id,
                type: "project_message",
            },
        });
        return res.status(201).json({
            message: "Message created successfully",
            data: message,
        });
    }
    catch (error) {
        console.error("Create message error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createMessage = createMessage;
const getMessages = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const messages = await prisma_js_1.default.message.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(req.user.role === "admin"
                    ? {}
                    : {
                        project: {
                            OR: [
                                { clientId: req.user.id },
                                { engineerId: req.user.id },
                                {
                                    projectMembers: {
                                        some: { userId: req.user.id, status: "accepted" },
                                    },
                                },
                            ],
                        },
                    }),
            },
            include: {
                project: true,
                sender: {
                    select: { id: true, name: true, email: true, role: true, image: true },
                },
            },
            orderBy: { createdAt: "asc" },
        });
        return res.json(messages);
    }
    catch (error) {
        console.error("Get messages error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMessages = getMessages;
const getMessageById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Message ID is required" });
        }
        const message = await prisma_js_1.default.message.findUnique({
            where: { id },
            include: {
                project: { include: { projectMembers: true } },
                sender: {
                    select: { id: true, name: true, email: true, role: true, image: true },
                },
            },
        });
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }
        if (!canAccessProject(message.project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(message);
    }
    catch (error) {
        console.error("Get message by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMessageById = getMessageById;
const updateMessage = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { content, photoUrl } = req.body;
        const files = req.files || [];
        if (!id) {
            return res.status(400).json({ message: "Message ID is required" });
        }
        const existing = await prisma_js_1.default.message.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Message not found" });
        }
        if (req.user.role !== "admin" && existing.senderId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const upload = files[0] ? await uploadImage(files[0]) : null;
        const message = await prisma_js_1.default.message.update({
            where: { id },
            data: {
                content,
                photoUrl: upload?.secure_url || photoUrl,
            },
            include: {
                sender: {
                    select: { id: true, name: true, email: true, role: true, image: true },
                },
            },
        });
        return res.json({
            message: "Message updated successfully",
            data: message,
        });
    }
    catch (error) {
        console.error("Update message error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateMessage = updateMessage;
const deleteMessage = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Message ID is required" });
        }
        const existing = await prisma_js_1.default.message.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Message not found" });
        }
        if (req.user.role !== "admin" && existing.senderId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await prisma_js_1.default.message.delete({ where: { id } });
        return res.json({ message: "Message deleted successfully" });
    }
    catch (error) {
        console.error("Delete message error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteMessage = deleteMessage;

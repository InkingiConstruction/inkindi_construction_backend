"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessage = exports.updateMessage = exports.getMessageById = exports.getMessages = exports.createMessage = exports.getConversations = void 0;
const client_1 = require("@prisma/client");
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
const userSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    image: true,
};
const buildProjectParticipants = (project) => {
    const participants = new Map();
    participants.set(project.client.id, project.client);
    if (project.engineer) {
        participants.set(project.engineer.id, project.engineer);
    }
    for (const member of project.projectMembers) {
        if (member.status === "accepted") {
            participants.set(member.user.id, member.user);
        }
    }
    return [...participants.values()];
};
const canDirectMessageUser = async (senderId, senderRole, recipientId) => {
    if (senderRole === "admin")
        return true;
    if (senderId === recipientId)
        return false;
    const sharedProject = await prisma_js_1.default.project.findFirst({
        where: {
            AND: [
                {
                    OR: [
                        { clientId: senderId },
                        { engineerId: senderId },
                        {
                            projectMembers: {
                                some: { userId: senderId, status: "accepted" },
                            },
                        },
                    ],
                },
                {
                    OR: [
                        { clientId: recipientId },
                        { engineerId: recipientId },
                        {
                            projectMembers: {
                                some: { userId: recipientId, status: "accepted" },
                            },
                        },
                    ],
                },
            ],
        },
        select: { id: true },
    });
    return Boolean(sharedProject);
};
const getConversations = async (req, res) => {
    try {
        const projectWhere = req.user.role === "admin"
            ? {}
            : {
                OR: [
                    { clientId: req.user.id },
                    { engineerId: req.user.id },
                    {
                        projectMembers: {
                            some: { userId: req.user.id, status: client_1.AssignmentStatus.accepted },
                        },
                    },
                ],
            };
        const [projects, directMessages] = await Promise.all([
            prisma_js_1.default.project.findMany({
                where: projectWhere,
                include: {
                    client: { select: userSelect },
                    engineer: { select: userSelect },
                    projectMembers: {
                        include: { user: { select: userSelect } },
                    },
                    messages: {
                        where: { recipientId: null },
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        include: { sender: { select: userSelect } },
                    },
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_js_1.default.message.findMany({
                where: req.user.role === "admin"
                    ? { recipientId: { not: null } }
                    : {
                        OR: [
                            { senderId: req.user.id, recipientId: { not: null } },
                            { recipientId: req.user.id },
                        ],
                    },
                include: {
                    sender: { select: userSelect },
                    recipient: { select: userSelect },
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);
        const groupConversations = projects.map((project) => {
            const participants = buildProjectParticipants(project);
            const lastMessage = project.messages[0] || null;
            return {
                id: `project:${project.id}`,
                type: "group",
                projectId: project.id,
                title: project.name,
                subtitle: participants
                    .map((participant) => participant.role)
                    .filter((role, index, roles) => roles.indexOf(role) === index)
                    .join(", "),
                participants,
                lastMessage,
                updatedAt: lastMessage?.createdAt || project.updatedAt,
            };
        });
        const directByUser = new Map();
        for (const message of directMessages) {
            const otherUser = message.senderId === req.user.id ? message.recipient : message.sender;
            if (!otherUser || directByUser.has(otherUser.id))
                continue;
            directByUser.set(otherUser.id, {
                id: `direct:${otherUser.id}`,
                type: "direct",
                recipientId: otherUser.id,
                title: otherUser.name || otherUser.email,
                subtitle: otherUser.role,
                participants: [otherUser],
                lastMessage: message,
                updatedAt: message.createdAt,
            });
        }
        const directContacts = new Map();
        for (const project of projects) {
            for (const participant of buildProjectParticipants(project)) {
                if (participant.id === req.user.id || directByUser.has(participant.id))
                    continue;
                directContacts.set(participant.id, {
                    id: `direct:${participant.id}`,
                    type: "direct",
                    recipientId: participant.id,
                    title: participant.name || participant.email,
                    subtitle: participant.role,
                    participants: [participant],
                    lastMessage: null,
                    updatedAt: project.updatedAt,
                });
            }
        }
        const conversations = [
            ...groupConversations,
            ...directByUser.values(),
            ...directContacts.values(),
        ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return res.json(conversations);
    }
    catch (error) {
        console.error("Get conversations error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getConversations = getConversations;
const createMessage = async (req, res) => {
    try {
        const { projectId, recipientId, content, photoUrl } = req.body;
        const files = req.files || [];
        if ((!projectId && !recipientId) || !content) {
            return res.status(400).json({
                message: "projectId or recipientId and content are required",
            });
        }
        const project = projectId
            ? await prisma_js_1.default.project.findUnique({
                where: { id: String(projectId) },
                include: { projectMembers: true },
            })
            : null;
        if (projectId && !project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (project && !canAccessProject(project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (recipientId) {
            const recipient = await prisma_js_1.default.user.findUnique({
                where: { id: String(recipientId) },
                select: { id: true },
            });
            if (!recipient) {
                return res.status(404).json({ message: "Recipient not found" });
            }
            const canMessage = await canDirectMessageUser(req.user.id, req.user.role, recipient.id);
            if (!canMessage) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        const upload = files[0] ? await uploadImage(files[0]) : null;
        const message = await prisma_js_1.default.message.create({
            data: {
                projectId: project?.id,
                senderId: req.user.id,
                recipientId: recipientId ? String(recipientId) : null,
                content,
                photoUrl: upload?.secure_url || photoUrl,
            },
            include: {
                project: true,
                sender: { select: userSelect },
                recipient: { select: userSelect },
            },
        });
        if (message.projectId) {
            await (0, notifications_js_1.notifyProjectParticipants)({
                projectId: message.projectId,
                excludeUserId: req.user.id,
                title: "New project message",
                body: `${message.sender.name}: ${message.content}`,
                data: {
                    messageId: message.id,
                    projectId: message.projectId,
                    type: "project_message",
                },
            });
        }
        else if (message.recipientId) {
            await (0, notifications_js_1.notifyUser)({
                userId: message.recipientId,
                title: "New message",
                body: `${message.sender.name}: ${message.content}`,
                data: {
                    messageId: message.id,
                    recipientId: message.senderId,
                    type: "direct_message",
                },
            });
        }
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
        const recipientId = typeof req.query.recipientId === "string"
            ? req.query.recipientId
            : undefined;
        if (!projectId && !recipientId) {
            return res
                .status(400)
                .json({ message: "projectId or recipientId is required" });
        }
        const messages = await prisma_js_1.default.message.findMany({
            where: {
                ...(projectId
                    ? { projectId, recipientId: null }
                    : {
                        OR: [
                            { senderId: req.user.id, recipientId },
                            { senderId: recipientId, recipientId: req.user.id },
                        ],
                    }),
                ...(req.user.role === "admin" || recipientId
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
                sender: { select: userSelect },
                recipient: { select: userSelect },
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
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                    },
                },
            },
        });
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }
        if (message.project) {
            if (!canAccessProject(message.project, req.user.id, req.user.role)) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        else if (req.user.role !== "admin" &&
            message.senderId !== req.user.id &&
            message.recipientId !== req.user.id) {
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
                editedAt: new Date(),
            },
            include: {
                project: true,
                sender: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                    },
                },
                recipient: { select: userSelect },
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

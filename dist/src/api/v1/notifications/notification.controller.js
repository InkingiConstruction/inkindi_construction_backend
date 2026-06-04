"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.updateNotification = exports.getNotificationById = exports.getNotifications = exports.createNotification = exports.registerExpoPushToken = void 0;
const client_1 = require("@prisma/client");
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const expo_js_1 = require("../../../lib/expo.js");
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
const isChannel = (value) => typeof value === "string" &&
    Object.values(client_1.NotificationChannel).includes(value);
const isStatus = (value) => typeof value === "string" &&
    Object.values(client_1.NotificationStatus).includes(value);
const getPushData = (value) => {
    const parsed = parseJson(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
    }
    return parsed;
};
const registerExpoPushToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== "string") {
            return res.status(400).json({ message: "Expo push token is required" });
        }
        if (!(0, expo_js_1.isExpoPushToken)(token)) {
            return res.status(400).json({ message: "Invalid Expo push token" });
        }
        const user = await prisma_js_1.default.user.update({
            where: { id: req.user.id },
            data: { fcmToken: token },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                fcmToken: true,
            },
        });
        return res.json({
            message: "Expo push token saved successfully",
            user,
        });
    }
    catch (error) {
        console.error("Register Expo push token error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.registerExpoPushToken = registerExpoPushToken;
const createNotification = async (req, res) => {
    try {
        const { userId, channel, title, body, data, status, failureReason } = req.body;
        if (!userId || !channel || !title || !body) {
            return res.status(400).json({
                message: "userId, channel, title and body are required",
            });
        }
        if (!isChannel(channel)) {
            return res.status(400).json({ message: "Invalid notification channel" });
        }
        if (status !== undefined && !isStatus(status)) {
            return res.status(400).json({ message: "Invalid notification status" });
        }
        const recipient = await prisma_js_1.default.user.findUnique({
            where: { id: String(userId) },
            select: {
                id: true,
                fcmToken: true,
            },
        });
        if (!recipient) {
            return res.status(404).json({ message: "Notification user not found" });
        }
        const notification = await prisma_js_1.default.notification.create({
            data: {
                userId: recipient.id,
                channel,
                title,
                body,
                data: parseJson(data) || {},
                status: status || "pending",
                failureReason,
                sentAt: status === "sent" ? new Date() : undefined,
                deliveredAt: status === "delivered" ? new Date() : undefined,
                readAt: status === "read" ? new Date() : undefined,
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
        if (channel === "push") {
            if (!recipient.fcmToken || !(0, expo_js_1.isExpoPushToken)(recipient.fcmToken)) {
                const failedNotification = await prisma_js_1.default.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: "failed",
                        failureReason: "User does not have a valid Expo push token",
                    },
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                    },
                });
                return res.status(201).json({
                    message: "Notification created but push delivery failed",
                    notification: failedNotification,
                });
            }
            try {
                const tickets = await (0, expo_js_1.sendExpoPushNotification)({
                    token: recipient.fcmToken,
                    title,
                    body,
                    data: getPushData(data),
                });
                const failedTicket = tickets.find((ticket) => ticket.status === "error");
                const sentNotification = await prisma_js_1.default.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: failedTicket ? "failed" : "sent",
                        sentAt: failedTicket ? undefined : new Date(),
                        failureReason: failedTicket && "message" in failedTicket
                            ? failedTicket.message
                            : undefined,
                        data: {
                            ...getPushData(data),
                            expoTickets: tickets,
                        },
                    },
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                    },
                });
                return res.status(201).json({
                    message: failedTicket
                        ? "Notification created but push delivery failed"
                        : "Push notification sent successfully",
                    notification: sentNotification,
                });
            }
            catch (pushError) {
                const failedNotification = await prisma_js_1.default.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: "failed",
                        failureReason: pushError instanceof Error
                            ? pushError.message
                            : "Expo push delivery failed",
                    },
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                    },
                });
                return res.status(201).json({
                    message: "Notification created but push delivery failed",
                    notification: failedNotification,
                });
            }
        }
        return res.status(201).json({
            message: "Notification created successfully",
            notification,
        });
    }
    catch (error) {
        console.error("Create notification error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createNotification = createNotification;
const getNotifications = async (req, res) => {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
        if (status !== undefined && !isStatus(status)) {
            return res.status(400).json({ message: "Invalid notification status" });
        }
        const notifications = await prisma_js_1.default.notification.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(userId && req.user.role === "admin"
                    ? { userId }
                    : { userId: req.user.id }),
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(notifications);
    }
    catch (error) {
        console.error("Get notifications error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getNotifications = getNotifications;
const getNotificationById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Notification ID is required" });
        }
        const notification = await prisma_js_1.default.notification.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }
        if (req.user.role !== "admin" && notification.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(notification);
    }
    catch (error) {
        console.error("Get notification by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getNotificationById = getNotificationById;
const updateNotification = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { status, data, failureReason, title, body } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Notification ID is required" });
        }
        if (status !== undefined && !isStatus(status)) {
            return res.status(400).json({ message: "Invalid notification status" });
        }
        const existing = await prisma_js_1.default.notification.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Notification not found" });
        }
        if (req.user.role !== "admin" && existing.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const notification = await prisma_js_1.default.notification.update({
            where: { id },
            data: {
                status,
                data: data !== undefined ? parseJson(data) : undefined,
                failureReason,
                title: req.user.role === "admin" ? title : undefined,
                body: req.user.role === "admin" ? body : undefined,
                sentAt: status === "sent" ? new Date() : undefined,
                deliveredAt: status === "delivered" ? new Date() : undefined,
                readAt: status === "read" ? new Date() : undefined,
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
        return res.json({
            message: "Notification updated successfully",
            notification,
        });
    }
    catch (error) {
        console.error("Update notification error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateNotification = updateNotification;
const deleteNotification = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Notification ID is required" });
        }
        const existing = await prisma_js_1.default.notification.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Notification not found" });
        }
        if (req.user.role !== "admin" && existing.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await prisma_js_1.default.notification.delete({ where: { id } });
        return res.json({ message: "Notification deleted successfully" });
    }
    catch (error) {
        console.error("Delete notification error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteNotification = deleteNotification;

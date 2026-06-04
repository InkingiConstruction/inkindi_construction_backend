"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyProjectParticipants = exports.notifyUsers = exports.notifyUser = void 0;
const prisma_js_1 = __importDefault(require("./prisma.js"));
const expo_js_1 = require("./expo.js");
const notifyUser = async ({ userId, title, body, data = {}, }) => {
    const user = await prisma_js_1.default.user.findUnique({
        where: { id: userId },
        select: { id: true, fcmToken: true },
    });
    if (!user)
        return null;
    const notification = await prisma_js_1.default.notification.create({
        data: {
            userId: user.id,
            channel: "push",
            title,
            body,
            data: data,
            status: "pending",
        },
    });
    if (!user.fcmToken || !(0, expo_js_1.isExpoPushToken)(user.fcmToken)) {
        return prisma_js_1.default.notification.update({
            where: { id: notification.id },
            data: {
                status: "failed",
                failureReason: "User does not have a valid Expo push token",
            },
        });
    }
    try {
        const tickets = await (0, expo_js_1.sendExpoPushNotification)({
            token: user.fcmToken,
            title,
            body,
            data,
        });
        const failedTicket = tickets.find((ticket) => ticket.status === "error");
        return prisma_js_1.default.notification.update({
            where: { id: notification.id },
            data: {
                status: failedTicket ? "failed" : "sent",
                sentAt: failedTicket ? undefined : new Date(),
                failureReason: failedTicket && "message" in failedTicket
                    ? failedTicket.message
                    : undefined,
                data: {
                    ...data,
                    expoTickets: tickets,
                },
            },
        });
    }
    catch (error) {
        return prisma_js_1.default.notification.update({
            where: { id: notification.id },
            data: {
                status: "failed",
                failureReason: error instanceof Error ? error.message : "Expo push delivery failed",
            },
        });
    }
};
exports.notifyUser = notifyUser;
const notifyUsers = async (users, notification) => {
    const uniqueUsers = [...new Set(users.filter(Boolean))];
    await Promise.allSettled(uniqueUsers.map((userId) => (0, exports.notifyUser)({ userId, ...notification })));
};
exports.notifyUsers = notifyUsers;
const notifyProjectParticipants = async ({ projectId, excludeUserId, title, body, data = {}, }) => {
    const project = await prisma_js_1.default.project.findUnique({
        where: { id: projectId },
        include: {
            projectMembers: {
                where: { status: "accepted" },
                select: { userId: true },
            },
        },
    });
    if (!project)
        return;
    const users = [
        project.clientId,
        project.engineerId,
        ...project.projectMembers.map((member) => member.userId),
    ].filter((userId) => Boolean(userId));
    await (0, exports.notifyUsers)(users.filter((userId) => userId !== excludeUserId), {
        title,
        body,
        data: { projectId, ...data },
    });
};
exports.notifyProjectParticipants = notifyProjectParticipants;

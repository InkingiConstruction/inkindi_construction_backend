"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpoPushReceipts = exports.sendExpoPushNotification = exports.isExpoPushToken = void 0;
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
});
const isExpoPushToken = (token) => expo_server_sdk_1.Expo.isExpoPushToken(token);
exports.isExpoPushToken = isExpoPushToken;
const sendExpoPushNotification = async ({ token, title, body, data, }) => {
    const message = {
        to: token,
        channelId: "default",
        priority: "high",
        sound: "default",
        title,
        body,
        data,
    };
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];
    for (const chunk of chunks) {
        const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
    }
    return tickets;
};
exports.sendExpoPushNotification = sendExpoPushNotification;
const getExpoPushReceipts = async (receiptIds) => {
    if (receiptIds.length === 0)
        return {};
    const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    const receipts = {};
    for (const chunk of chunks) {
        const chunkReceipts = await expo.getPushNotificationReceiptsAsync(chunk);
        Object.assign(receipts, chunkReceipts);
    }
    return receipts;
};
exports.getExpoPushReceipts = getExpoPushReceipts;

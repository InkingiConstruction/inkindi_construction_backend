"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendExpoPushNotification = exports.isExpoPushToken = void 0;
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
});
const isExpoPushToken = (token) => expo_server_sdk_1.Expo.isExpoPushToken(token);
exports.isExpoPushToken = isExpoPushToken;
const sendExpoPushNotification = async ({ token, title, body, data, }) => {
    const message = {
        to: token,
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

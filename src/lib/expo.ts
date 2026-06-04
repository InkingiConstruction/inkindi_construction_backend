import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export const isExpoPushToken = (token: string) => Expo.isExpoPushToken(token);

export const sendExpoPushNotification = async ({
  token,
  title,
  body,
  data,
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) => {
  const message: ExpoPushMessage = {
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

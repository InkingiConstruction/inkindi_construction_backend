import { Prisma } from "@prisma/client";
import prisma from "./prisma.js";
import { isExpoPushToken, sendExpoPushNotification } from "./expo.js";

type NotifyUserInput = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export const notifyUser = async ({
  userId,
  title,
  body,
  data = {},
}: NotifyUserInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fcmToken: true },
  });

  if (!user) return null;

  const notification = await prisma.notification.create({
    data: {
      userId: user.id,
      channel: "push",
      title,
      body,
      data: data as Prisma.InputJsonValue,
      status: "pending",
    },
  });

  if (!user.fcmToken || !isExpoPushToken(user.fcmToken)) {
    return prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "failed",
        failureReason: "User does not have a valid Expo push token",
      },
    });
  }

  try {
    const tickets = await sendExpoPushNotification({
      token: user.fcmToken,
      title,
      body,
      data,
    });
    const failedTicket = tickets.find((ticket) => ticket.status === "error");

    return prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: failedTicket ? "failed" : "sent",
        sentAt: failedTicket ? undefined : new Date(),
        failureReason:
          failedTicket && "message" in failedTicket
            ? failedTicket.message
            : undefined,
        data: {
          ...data,
          expoTickets: tickets,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    return prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "failed",
        failureReason:
          error instanceof Error ? error.message : "Expo push delivery failed",
      },
    });
  }
};

export const notifyUsers = async (
  users: string[],
  notification: Omit<NotifyUserInput, "userId">,
) => {
  const uniqueUsers = [...new Set(users.filter(Boolean))];

  await Promise.allSettled(
    uniqueUsers.map((userId) => notifyUser({ userId, ...notification })),
  );
};

export const notifyProjectParticipants = async ({
  projectId,
  excludeUserId,
  title,
  body,
  data = {},
}: {
  projectId: string;
  excludeUserId?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectMembers: {
        where: { status: "accepted" },
        select: { userId: true },
      },
    },
  });

  if (!project) return;

  const users = [
    project.clientId,
    project.engineerId,
    ...project.projectMembers.map((member) => member.userId),
  ].filter((userId): userId is string => Boolean(userId));

  await notifyUsers(
    users.filter((userId) => userId !== excludeUserId),
    {
      title,
      body,
      data: { projectId, ...data },
    },
  );
};

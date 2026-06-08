import { Prisma } from "@prisma/client";
import prisma from "./prisma.js";
import { getExpoPushReceipts, isExpoPushToken, sendExpoPushNotification } from "./expo.js";
import { sendEmail } from "../config/resend.js";

type NotifyUserInput = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const wantsChannel = (
  prefs: Prisma.JsonValue | null | undefined,
  channel: "push" | "email",
) => {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return true;
  return (prefs as Record<string, unknown>)[channel] !== false;
};

const sendNotificationEmail = ({
  email,
  title,
  body,
}: {
  email: string;
  title: string;
  body: string;
}) => {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br />");

  return sendEmail({
    to: email,
    subject: title,
    text: body,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:24px;">
          <p style="margin:0 0 8px; color:#0f766e; font-size:12px; font-weight:700; letter-spacing:.08em;">INKINGI CONSTRUCTION</p>
          <h2 style="margin:0 0 12px; color:#0f172a; font-size:22px;">${safeTitle}</h2>
          <p style="margin:0; color:#475569; font-size:15px; line-height:1.6;">${safeBody}</p>
        </div>
      </div>
    `,
  });
};

const checkPushReceiptsLater = ({
  notificationId,
  receiptIds,
}: {
  notificationId: string;
  receiptIds: string[];
}) => {
  if (receiptIds.length === 0) return;

  setTimeout(() => {
    void (async () => {
      try {
        const receipts = await getExpoPushReceipts(receiptIds);
        const failedReceipt = Object.values(receipts).find(
          (receipt) => receipt.status === "error",
        );

        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: failedReceipt ? "failed" : "delivered",
            deliveredAt: failedReceipt ? undefined : new Date(),
            failureReason: failedReceipt?.message,
            data: {
              receiptIds,
              expoReceipts: receipts,
            } as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            failureReason:
              error instanceof Error
                ? `Receipt check failed: ${error.message}`
                : "Receipt check failed",
          },
        });
      }
    })();
  }, 5000);
};

export const notifyUser = async ({
  userId,
  title,
  body,
  data = {},
}: NotifyUserInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fcmToken: true,
      notificationPrefs: true,
    },
  });

  if (!user) return null;

  const baseData = data as Prisma.InputJsonValue;

  const inAppNotification = await prisma.notification.create({
    data: {
      userId: user.id,
      channel: "in_app",
      title,
      body,
      data: baseData,
      status: "sent",
      sentAt: new Date(),
    },
  });

  if (wantsChannel(user.notificationPrefs, "email")) {
    const emailNotification = await prisma.notification.create({
      data: {
        userId: user.id,
        channel: "email",
        title,
        body,
        data: baseData,
        status: "pending",
      },
    });

    try {
      const sent = await sendNotificationEmail({
        email: user.email,
        title,
        body,
      });

      await prisma.notification.update({
        where: { id: emailNotification.id },
        data: {
          status: sent ? "sent" : "failed",
          sentAt: sent ? new Date() : undefined,
          failureReason: sent ? undefined : "Email provider did not accept the message",
        },
      });
    } catch (error) {
      await prisma.notification.update({
        where: { id: emailNotification.id },
        data: {
          status: "failed",
          failureReason:
            error instanceof Error ? error.message : "Email delivery failed",
        },
      });
    }
  }

  if (!wantsChannel(user.notificationPrefs, "push")) {
    return inAppNotification;
  }

  const pushNotification = await prisma.notification.create({
    data: {
      userId: user.id,
      channel: "push",
      title,
      body,
      data: baseData,
      status: "pending",
    },
  });

  if (!user.fcmToken || !isExpoPushToken(user.fcmToken)) {
    await prisma.notification.update({
      where: { id: pushNotification.id },
      data: {
        status: "failed",
        failureReason: "User does not have a valid Expo push token",
      },
    });
    return inAppNotification;
  }

  try {
    const tickets = await sendExpoPushNotification({
      token: user.fcmToken,
      title,
      body,
      data,
    });
    const failedTicket = tickets.find((ticket) => ticket.status === "error");
    const receiptIds = tickets
      .filter((ticket): ticket is typeof ticket & { id: string } => ticket.status === "ok" && "id" in ticket)
      .map((ticket) => ticket.id);

    await prisma.notification.update({
      where: { id: pushNotification.id },
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
          receiptIds,
        } as Prisma.InputJsonValue,
      },
    });
    if (!failedTicket) {
      checkPushReceiptsLater({
        notificationId: pushNotification.id,
        receiptIds,
      });
    }
    return inAppNotification;
  } catch (error) {
    await prisma.notification.update({
      where: { id: pushNotification.id },
      data: {
        status: "failed",
        failureReason:
          error instanceof Error ? error.message : "Expo push delivery failed",
      },
    });
    return inAppNotification;
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

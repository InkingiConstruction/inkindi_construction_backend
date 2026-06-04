import prisma from "../../config/db";
import { Request } from "express";

export const audit = async (params: {
  req?: Request;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  projectId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  result: "success" | "failure";
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? params.req?.user?.id,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        projectId: params.projectId,
        oldValues: params.oldValues as any,
        newValues: params.newValues as any,
        ipAddress: params.req?.ip,
        userAgent: params.req?.headers["user-agent"] as string,
        result: params.result,
      },
    });
  } catch (e) {
    console.error("Audit log failure:", e);
  }
};

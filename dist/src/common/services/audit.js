"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.audit = void 0;
const db_1 = __importDefault(require("../../config/db"));
const audit = async (params) => {
    try {
        await db_1.default.auditLog.create({
            data: {
                actorId: params.actorId ?? params.req?.user?.id,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                projectId: params.projectId,
                oldValues: params.oldValues,
                newValues: params.newValues,
                ipAddress: params.req?.ip,
                userAgent: params.req?.headers["user-agent"],
                result: params.result,
            },
        });
    }
    catch (e) {
        console.error("Audit log failure:", e);
    }
};
exports.audit = audit;

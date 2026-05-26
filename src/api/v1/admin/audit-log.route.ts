import { Router } from "express";
import {
  createAuditLog,
  deleteAuditLog,
  getAuditLogById,
  getAuditLogs,
  updateAuditLog,
} from "./audit-log.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("admin"), createAuditLog);
router.get("/", requiredAuth, requireRole("admin"), getAuditLogs);
router.get("/:id", requiredAuth, requireRole("admin"), getAuditLogById);
router.put("/:id", requiredAuth, requireRole("admin"), updateAuditLog);
router.delete("/:id", requiredAuth, requireRole("admin"), deleteAuditLog);

export default router;

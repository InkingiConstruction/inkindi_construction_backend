import { Router } from "express";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  createDailyReport,
  createDeliveryVerification,
  createInventoryLog,
  listDailyReports,
  listDeliveryVerifications,
  listInventoryLogs,
} from "./site-agent.controller";

const router = Router();

router.get(
  "/daily-reports",
  requiredAuth,
  requireRole("site_agent", "client", "engineer", "supervisor", "admin"),
  listDailyReports,
);
router.post(
  "/daily-reports",
  requiredAuth,
  requireRole("site_agent", "engineer", "admin"),
  createDailyReport,
);

router.get(
  "/inventory-logs",
  requiredAuth,
  requireRole("site_agent", "client", "engineer", "supervisor", "admin"),
  listInventoryLogs,
);
router.post(
  "/inventory-logs",
  requiredAuth,
  requireRole("site_agent", "engineer", "admin"),
  createInventoryLog,
);

router.get(
  "/delivery-verifications",
  requiredAuth,
  requireRole("site_agent", "client", "engineer", "supervisor", "supplier", "admin"),
  listDeliveryVerifications,
);
router.post(
  "/delivery-verifications",
  requiredAuth,
  requireRole("site_agent", "engineer", "admin"),
  createDeliveryVerification,
);

export default router;

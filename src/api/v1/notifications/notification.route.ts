import { Router } from "express";
import {
  createNotification,
  deleteNotification,
  getNotificationById,
  getNotifications,
  registerExpoPushToken,
  sendTestPushNotification,
  updateNotification,
} from "./notification.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("admin"), createNotification);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), getNotifications);
router.post("/expo-token", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), registerExpoPushToken);
router.post("/test-push", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), sendTestPushNotification);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), getNotificationById);
router.put("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), updateNotification);
router.delete("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), deleteNotification);

export default router;

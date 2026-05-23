import { Router } from "express";
import {
  createNotification,
  deleteNotification,
  getNotificationById,
  getNotifications,
  updateNotification,
} from "../controllers/notification.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("admin"), createNotification);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getNotifications);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getNotificationById);
router.put("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), updateNotification);
router.delete("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), deleteNotification);

export default router;

import { Router } from "express";
import {
  createMessage,
  deleteMessage,
  getConversations,
  getMessageById,
  getMessages,
  updateMessage,
} from "./message.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadImages } from "../middleware/upload.middleware";

const router = Router();

router.post(
  "/",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "admin"),
  uploadImages,
  createMessage,
);
router.get(
  "/conversations",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "admin"),
  getConversations,
);
router.get(
  "/",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "admin"),
  getMessages,
);
router.get(
  "/:id",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "admin"),
  getMessageById,
);
router.put(
  "/:id",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "admin"),
  uploadImages,
  updateMessage,
);
router.delete(
  "/:id",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "admin"),
  deleteMessage,
);

export default router;

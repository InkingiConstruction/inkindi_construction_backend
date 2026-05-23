import { Router } from "express";
import {
  createProgressPhoto,
  deleteProgressPhoto,
  getProgressPhotoById,
  getProgressPhotos,
  updateProgressPhoto,
} from "../controllers/progress-photo.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("engineer", "supervisor", "admin"), createProgressPhoto);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "admin"), getProgressPhotos);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "admin"), getProgressPhotoById);
router.put("/:id", requiredAuth, requireRole("engineer", "supervisor", "admin"), updateProgressPhoto);
router.delete("/:id", requiredAuth, requireRole("engineer", "supervisor", "admin"), deleteProgressPhoto);

export default router;

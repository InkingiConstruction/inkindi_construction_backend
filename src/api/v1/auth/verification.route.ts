import { Router } from "express";
import {
  createVerification,
  deleteVerification,
  getVerificationById,
  getVerifications,
  updateVerification,
} from "./verification.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("admin"), createVerification);
router.get("/", requiredAuth, requireRole("admin"), getVerifications);
router.get("/:id", requiredAuth, requireRole("admin"), getVerificationById);
router.put("/:id", requiredAuth, requireRole("admin"), updateVerification);
router.delete("/:id", requiredAuth, requireRole("admin"), deleteVerification);

export default router;

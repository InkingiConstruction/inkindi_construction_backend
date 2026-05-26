import { Router } from "express";
import {
  createMilestone,
  deleteMilestone,
  getMilestoneById,
  getMilestones,
  updateMilestone,
} from "./milestone.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("engineer", "admin"), createMilestone);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "admin"), getMilestones);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "admin"), getMilestoneById);
router.put("/:id", requiredAuth, requireRole("engineer", "supervisor", "admin"), updateMilestone);
router.delete("/:id", requiredAuth, requireRole("engineer", "admin"), deleteMilestone);

export default router;

import { Router } from "express";
import {
  createInspection,
  deleteInspection,
  getInspectionById,
  getInspections,
  updateInspection,
} from "../controllers/inspection.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("supervisor", "admin"), createInspection);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "admin"), getInspections);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "admin"), getInspectionById);
router.put("/:id", requiredAuth, requireRole("supervisor", "admin"), updateInspection);
router.delete("/:id", requiredAuth, requireRole("supervisor", "admin"), deleteInspection);

export default router;

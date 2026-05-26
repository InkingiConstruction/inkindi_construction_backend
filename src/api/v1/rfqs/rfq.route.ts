import { Router } from "express";
import {
  createRfq,
  deleteRfq,
  getRfqById,
  getRfqs,
  updateRfq,
} from "./rfq.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("engineer", "admin"), createRfq);
router.get("/", requiredAuth, requireRole("engineer", "supplier", "admin"), getRfqs);
router.get("/:id", requiredAuth, requireRole("engineer", "supplier", "admin"), getRfqById);
router.put("/:id", requiredAuth, requireRole("engineer", "admin"), updateRfq);
router.delete("/:id", requiredAuth, requireRole("engineer", "admin"), deleteRfq);

export default router;

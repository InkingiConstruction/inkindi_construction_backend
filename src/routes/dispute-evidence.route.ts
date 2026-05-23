import { Router } from "express";
import {
  createDisputeEvidence,
  deleteDisputeEvidence,
  getDisputeEvidenceById,
  getDisputeEvidences,
  updateDisputeEvidence,
} from "../controllers/dispute-evidence.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("client", "engineer", "supplier"), createDisputeEvidence);
router.get("/", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), getDisputeEvidences);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), getDisputeEvidenceById);
router.put("/:id", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), updateDisputeEvidence);
router.delete("/:id", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), deleteDisputeEvidence);

export default router;

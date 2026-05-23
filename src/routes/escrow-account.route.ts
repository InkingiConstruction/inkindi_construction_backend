import { Router } from "express";
import {
  createEscrowAccount,
  deleteEscrowAccount,
  getEscrowAccountById,
  getEscrowAccounts,
  updateEscrowAccount,
} from "../controllers/escrow-account.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("admin"), createEscrowAccount);
router.get("/", requiredAuth, requireRole("client", "engineer", "admin"), getEscrowAccounts);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "admin"), getEscrowAccountById);
router.put("/:id", requiredAuth, requireRole("admin"), updateEscrowAccount);
router.delete("/:id", requiredAuth, requireRole("admin"), deleteEscrowAccount);

export default router;

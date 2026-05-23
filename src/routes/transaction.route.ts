import { Router } from "express";
import {
  createTransaction,
  deleteTransaction,
  getTransactionById,
  getTransactions,
  updateTransaction,
} from "../controllers/transaction.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("client", "admin"), createTransaction);
router.get("/", requiredAuth, requireRole("client", "engineer", "admin"), getTransactions);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "admin"), getTransactionById);
router.put("/:id", requiredAuth, requireRole("admin"), updateTransaction);
router.delete("/:id", requiredAuth, requireRole("admin"), deleteTransaction);

export default router;

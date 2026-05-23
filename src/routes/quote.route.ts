import { Router } from "express";
import {
  createQuote,
  deleteQuote,
  getQuoteById,
  getQuotes,
  updateQuote,
} from "../controllers/quote.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("supplier"), createQuote);
router.get("/", requiredAuth, requireRole("engineer", "supplier", "admin"), getQuotes);
router.get("/:id", requiredAuth, requireRole("engineer", "supplier", "admin"), getQuoteById);
router.put("/:id", requiredAuth, requireRole("supplier", "engineer", "admin"), updateQuote);
router.delete("/:id", requiredAuth, requireRole("supplier", "admin"), deleteQuote);

export default router;

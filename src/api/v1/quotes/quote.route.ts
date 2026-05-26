import { Router } from "express";
import {
  createQuote,
  deleteQuote,
  getQuoteById,
  getQuotes,
  updateQuote,
} from "./quote.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadImages } from "../middleware/upload.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("supplier"), uploadImages, createQuote);
router.get("/", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), getQuotes);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), getQuoteById);
router.put("/:id", requiredAuth, requireRole("supplier", "engineer", "admin"), uploadImages, updateQuote);
router.delete("/:id", requiredAuth, requireRole("supplier", "admin"), deleteQuote);

export default router;

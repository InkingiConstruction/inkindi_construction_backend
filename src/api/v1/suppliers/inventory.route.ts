import { Router } from "express";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItems,
  updateInventoryItem,
} from "./inventory.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("supplier", "admin"), createInventoryItem);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getInventoryItems);
router.put("/:id", requiredAuth, requireRole("supplier", "admin"), updateInventoryItem);
router.delete("/:id", requiredAuth, requireRole("supplier", "admin"), deleteInventoryItem);

export default router;

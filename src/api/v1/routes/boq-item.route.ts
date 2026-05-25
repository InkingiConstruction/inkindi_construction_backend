import { Router } from "express";
import {
  createBoqItem,
  deleteBoqItem,
  getBoqItemById,
  getBoqItems,
  updateBoqItem,
} from "../controllers/boq-item.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("engineer", "admin"), createBoqItem);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getBoqItems);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getBoqItemById);
router.put("/:id", requiredAuth, requireRole("engineer", "admin"), updateBoqItem);
router.delete("/:id", requiredAuth, requireRole("engineer", "admin"), deleteBoqItem);

export default router;

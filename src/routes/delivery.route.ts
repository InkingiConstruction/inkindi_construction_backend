import { Router } from "express";
import {
  createDelivery,
  deleteDelivery,
  getDeliveryById,
  getDeliverys,
  updateDelivery,
} from "../controllers/delivery.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("supplier"), createDelivery);
router.get("/", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), getDeliverys);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), getDeliveryById);
router.put("/:id", requiredAuth, requireRole("supplier", "engineer", "client", "admin"), updateDelivery);
router.delete("/:id", requiredAuth, requireRole("supplier", "admin"), deleteDelivery);

export default router;

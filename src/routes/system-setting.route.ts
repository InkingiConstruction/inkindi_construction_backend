import { Router } from "express";
import {
  createSystemSetting,
  deleteSystemSetting,
  getSystemSettingById,
  getSystemSettings,
  updateSystemSetting,
} from "../controllers/system-setting.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("admin"), createSystemSetting);
router.get("/", requiredAuth, requireRole("admin"), getSystemSettings);
router.get("/:id", requiredAuth, requireRole("admin"), getSystemSettingById);
router.put("/:id", requiredAuth, requireRole("admin"), updateSystemSetting);
router.delete("/:id", requiredAuth, requireRole("admin"), deleteSystemSetting);

export default router;

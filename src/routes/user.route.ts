import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  updateUser,
} from "../controllers/user.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("admin"), createUser);
router.get("/", requiredAuth, requireRole("admin"), getUsers);
router.get("/:id", requiredAuth, requireRole("admin"), getUserById);
router.put("/:id", requiredAuth, requireRole("admin"), updateUser);
router.delete("/:id", requiredAuth, requireRole("admin"), deleteUser);

export default router;

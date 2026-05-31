import { Router } from "express";
import {
  createUser,
  deleteUser,
  getEngineers,
  getSuppliers,
  getSupervisors,
  getUserById,
  getUsers,
  updateUser,
} from "./user.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadImages } from "../middleware/upload.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("admin"), uploadImages, createUser);
router.get("/", requiredAuth, requireRole("admin"), getUsers);
router.get("/engineers", requiredAuth, requireRole("client", "admin"), getEngineers);
router.get("/supervisors", requiredAuth, requireRole("client", "engineer", "admin"), getSupervisors);
router.get("/suppliers", requiredAuth, requireRole("client", "engineer", "supplier", "admin"), getSuppliers);
router.get("/:id", requiredAuth, requireRole("admin"), getUserById);
router.put("/:id", requiredAuth, requireRole("admin"), uploadImages, updateUser);
router.delete("/:id", requiredAuth, requireRole("admin"), deleteUser);

export default router;

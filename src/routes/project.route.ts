import { Router } from "express";
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateProject,
} from "../controllers/project.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("client"), createProject);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getProjects);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getProjectById);
router.put("/:id", requiredAuth, requireRole("client", "engineer", "admin"), updateProject);
router.delete("/:id", requiredAuth, requireRole("client", "admin"), deleteProject);

export default router;

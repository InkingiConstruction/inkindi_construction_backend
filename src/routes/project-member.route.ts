import { Router } from "express";
import {
  createProjectMember,
  deleteProjectMember,
  getProjectMemberById,
  getProjectMembers,
  updateProjectMember,
} from "../controllers/project-member.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post("/", requiredAuth, requireRole("client", "engineer", "admin"), createProjectMember);
router.get("/", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getProjectMembers);
router.get("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), getProjectMemberById);
router.put("/:id", requiredAuth, requireRole("client", "engineer", "supervisor", "supplier", "admin"), updateProjectMember);
router.delete("/:id", requiredAuth, requireRole("client", "engineer", "admin"), deleteProjectMember);

export default router;

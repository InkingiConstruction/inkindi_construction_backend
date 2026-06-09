import { Router } from "express";
import {
  acceptProjectMember,
  createProjectMember,
  deleteProjectMember,
  getProjectMemberById,
  getProjectMembers,
  rejectProjectMember,
  updateProjectMember,
} from "./project-member.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.post(
  "/",
  requiredAuth,
  requireRole("client", "engineer", "admin"),
  createProjectMember,
);
router.get(
  "/",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"),
  getProjectMembers,
);
router.post(
  "/:id/accept",
  requiredAuth,
  requireRole("engineer", "supervisor", "site_agent", "admin"),
  acceptProjectMember,
);
router.post(
  "/:id/reject",
  requiredAuth,
  requireRole("engineer", "supervisor", "site_agent", "admin"),
  rejectProjectMember,
);
router.get(
  "/:id",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"),
  getProjectMemberById,
);
router.put(
  "/:id",
  requiredAuth,
  requireRole("client", "engineer", "supervisor", "supplier", "site_agent", "admin"),
  updateProjectMember,
);
router.delete(
  "/:id",
  requiredAuth,
  requireRole("client", "engineer", "admin"),
  deleteProjectMember,
);

export default router;

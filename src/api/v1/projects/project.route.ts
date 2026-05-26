/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : project.route.ts
 * WHAT THIS FILE DOES : Declares API endpoints for Project resources
 * HOW IT DOES IT      : Sets HTTP methods, integrates role barriers, enables multi-photo uploads, and registers cache triggers
 * DATA SOURCE         : Express HTTP Requests
 * DATA DESTINATION    : Project controllers
 * PRINCIPLE APPLIED   : SOLID (Decoupled route logic with middlewares)
 * ============================================================================
 */

import { Router } from "express";
import {
  changeProjectImage,
  createProject,
  deleteProjectImage,
  deleteProject,
  getProjectById,
  getProjects,
  toggleProjectStatus,
  updateProject,
} from "./project.controller";
import { requiredAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadImages } from "../middleware/upload.middleware";
import { cacheMiddleware } from "../../../common/services/cache.service";

const router = Router();

/**
 * 🧱 CODE BLOCK: Project Routes Map
 * WHAT IT IS DOING: Registers GET, POST, PATCH, PUT, and DELETE routes with standard RBAC controls
 * WHY IT IS HERE  : Centralizes entry points for Client, Engineer, and Supplier interactions
 * PRINCIPLE       : SOLID
 * DATA SOURCE     : Client API requests
 * DATA DESTINATION: Project controller triggers
 */

router.post("/", requiredAuth, requireRole("client"), uploadImages, createProject);

router.get(
  "/", 
  requiredAuth, 
  requireRole("client", "engineer", "supervisor", "supplier", "admin"), 
  cacheMiddleware(30), // Caches project listings for 30s
  getProjects
);

router.get(
  "/:id", 
  requiredAuth, 
  requireRole("client", "engineer", "supervisor", "supplier", "admin"), 
  cacheMiddleware(30), // Caches project detail pages for 30s
  getProjectById
);

router.patch("/:id/status", requiredAuth, requireRole("client", "engineer", "admin"), toggleProjectStatus);
router.patch("/:id/images", requiredAuth, requireRole("client", "engineer", "admin"), uploadImages, changeProjectImage);
router.delete("/:id/images", requiredAuth, requireRole("client", "engineer", "admin"), deleteProjectImage);
router.put("/:id", requiredAuth, requireRole("client", "engineer", "admin"), uploadImages, updateProject);
router.delete("/:id", requiredAuth, requireRole("client", "admin"), deleteProject);

export default router;

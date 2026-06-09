"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("./project.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const cache_service_1 = require("../../../common/services/cache.service");
const router = (0, express_1.Router)();
/**
 * 🧱 CODE BLOCK: Project Routes Map
 * WHAT IT IS DOING: Registers GET, POST, PATCH, PUT, and DELETE routes with standard RBAC controls
 * WHY IT IS HERE  : Centralizes entry points for Client, Engineer, and Supplier interactions
 * PRINCIPLE       : SOLID
 * DATA SOURCE     : Client API requests
 * DATA DESTINATION: Project controller triggers
 */
router.post("/", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client"), upload_middleware_1.uploadImages, project_controller_1.createProject);
router.get("/", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), (0, cache_service_1.cacheMiddleware)(30), // Caches project listings for 30s
project_controller_1.getProjects);
router.get("/:id/feed", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), (0, cache_service_1.cacheMiddleware)(15), project_controller_1.getProjectFeed);
router.get("/:id", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "supervisor", "supplier", "site_agent", "admin"), (0, cache_service_1.cacheMiddleware)(30), // Caches project detail pages for 30s
project_controller_1.getProjectById);
router.patch("/:id/status", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "admin"), project_controller_1.toggleProjectStatus);
router.patch("/:id/images", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "admin"), upload_middleware_1.uploadImages, project_controller_1.changeProjectImage);
router.delete("/:id/images", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "admin"), project_controller_1.deleteProjectImage);
router.put("/:id", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "engineer", "admin"), upload_middleware_1.uploadImages, project_controller_1.updateProject);
router.delete("/:id", auth_middleware_1.requiredAuth, (0, role_middleware_1.requireRole)("client", "admin"), project_controller_1.deleteProject);
exports.default = router;

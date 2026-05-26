/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : project.controller.ts
 * WHAT THIS FILE DOES : Receives REST API calls and coordinates Project operations
 * HOW IT DOES IT      : Parses request parameters, delegates to ProjectService, and translates outcomes to JSON HTTP responses
 * DATA SOURCE         : Express Request payloads (req.body, req.params, req.files)
 * DATA DESTINATION    : Express Response streams (res.json, status codes)
 * PRINCIPLE APPLIED   : SOLID (Isolated HTTP delivery controller)
 * ============================================================================
 */

import { Request, Response } from "express";
import { ProjectService, ProjectMediaCollection } from "./project.service";

const getParamId = (id: string | string[] | undefined): string | undefined =>
  Array.isArray(id) ? id[0] : id;

/**
 * 🧱 CODE BLOCK: Project HTTP Route Actions
 * WHAT IT IS DOING: Handles controller actions for Project creation, query, edit, status toggle, and deletion
 * WHY IT IS HERE  : Interfaces express framework pipelines directly to background logic layers
 * PRINCIPLE       : SOLID (This layer only manages web concerns)
 */

export const createProject = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const files = (req.files as Express.Multer.File[]) || [];
    
    const project = await ProjectService.createProject(userId, req.body, files);

    return res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error: any) {
    const status = error.message.includes("Missing") ? 400 : 500;
    return res.status(status).json({ message: error.message || "Internal Server Error" });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    const projects = await ProjectService.getProjects(role, userId);
    return res.json(projects);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Project ID is required" });
    }

    const project = await ProjectService.getProjectById(id, req.user.id, req.user.role);
    return res.json(project);
  } catch (error: any) {
    const status = error.message === "Project not found" ? 404 : error.message === "Forbidden" ? 403 : 500;
    return res.status(status).json({ message: error.message || "Internal Server Error" });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Project ID is required" });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const project = await ProjectService.updateProject(id, req.user.id, req.user.role, req.body, files);

    return res.json({
      message: "Project updated successfully",
      project,
    });
  } catch (error: any) {
    const status = error.message === "Project not found" ? 404 : error.message === "Forbidden" ? 403 : 500;
    return res.status(status).json({ message: error.message || "Internal Server Error" });
  }
};

export const toggleProjectStatus = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Project ID is required" });
    }

    const project = await ProjectService.toggleProjectStatus(id, req.user.id, req.user.role, req.body.status);

    return res.json({
      message: "Project status updated successfully",
      project,
    });
  } catch (error: any) {
    const status = error.message === "Project not found" ? 404 : error.message === "Forbidden" ? 403 : 400;
    return res.status(status).json({ message: error.message || "Internal Server Error" });
  }
};

export const changeProjectImage = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { collection, publicId } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];
    const file = files[0];

    if (!id || !collection || !publicId || !file) {
      return res.status(400).json({ message: "Missing required params (id, collection, publicId, file)" });
    }

    const project = await ProjectService.changeProjectImage(
      id,
      req.user.id,
      req.user.role,
      collection as ProjectMediaCollection,
      publicId,
      file
    );

    return res.json({
      message: "Project image changed successfully",
      project,
    });
  } catch (error: any) {
    const status = error.message === "Project not found" ? 404 : error.message === "Forbidden" ? 403 : 400;
    return res.status(status).json({ message: error.message || "Internal Server Error" });
  }
};

export const deleteProjectImage = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { collection, publicId } = req.body;

    if (!id || !collection || !publicId) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const project = await ProjectService.deleteProjectImage(
      id,
      req.user.id,
      req.user.role,
      collection as ProjectMediaCollection,
      publicId
    );

    return res.json({
      message: "Project image deleted successfully",
      project,
    });
  } catch (error: any) {
    const status = error.message === "Project not found" ? 404 : error.message === "Forbidden" ? 403 : 400;
    return res.status(status).json({ message: error.message || "Internal Server Error" });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Project ID is required" });
    }

    await ProjectService.deleteProject(id, req.user.id, req.user.role);
    return res.json({ message: "Project deleted successfully" });
  } catch (error: any) {
    const status = error.message === "Project not found" ? 404 : error.message === "Forbidden" ? 403 : 500;
    return res.status(status).json({ message: error.message || "Internal Server Error" });
  }
};

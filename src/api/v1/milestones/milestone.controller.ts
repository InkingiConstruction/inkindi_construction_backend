/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : milestone.controller.ts
 * WHAT THIS FILE DOES : Receives REST API calls and coordinates Milestone operations
 * HOW IT DOES IT      : Parses request parameters, delegates to MilestoneService, and translates outcomes to JSON HTTP responses
 * DATA SOURCE         : Express Request payloads
 * DATA DESTINATION    : Express Response streams
 * PRINCIPLE APPLIED   : SOLID (Isolated HTTP delivery controller)
 * ============================================================================
 */

import { Request, Response } from "express";
import { MilestoneService } from "./milestone.service";

const getParamId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

/**
 * 🧱 CODE BLOCK: Milestone HTTP Route Actions
 * WHAT IT IS DOING: Handles controller actions for Milestone creation, query, edit, and deletion
 * WHY IT IS HERE  : Interfaces express framework pipelines directly to background logic layers
 * PRINCIPLE       : SOLID (This layer only manages web concerns)
 */

export const createMilestone = async (req: Request, res: Response) => {
  try {
    const milestone = await MilestoneService.createMilestone(req.body, req.user.id, req.user.role);
    return res.status(201).json({ message: "Milestone created successfully", milestone });
  } catch (error: any) {
    console.error("Create milestone error:", error);
    if (error.message.includes("required") || error.message.includes("Invalid") || error.message.includes("exceed") || error.message.includes("belong") || error.message.includes("no accepted engineer")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === "Project not found") return res.status(404).json({ message: error.message });
    if (error.message === "ENGINEER_ONLY") return res.status(403).json({ message: "Only the accepted project engineer or admin can create milestones" });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMilestones = async (req: Request, res: Response) => {
  try {
    const milestones = await MilestoneService.getMilestones(req.query, req.user.id, req.user.role);
    return res.json(milestones);
  } catch (error: any) {
    console.error("Get milestones error:", error);
    if (error.message.includes("Invalid")) return res.status(400).json({ message: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMilestoneById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    if (!id) return res.status(400).json({ message: "Milestone ID is required" });

    const milestone = await MilestoneService.getMilestoneById(id, req.user.id, req.user.role);
    return res.json(milestone);
  } catch (error: any) {
    console.error("Get milestone by ID error:", error);
    if (error.message === "Milestone not found") return res.status(404).json({ message: error.message });
    if (error.message === "Forbidden") return res.status(403).json({ message: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateMilestone = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    if (!id) return res.status(400).json({ message: "Milestone ID is required" });

    const milestone = await MilestoneService.updateMilestone(id, req.body, req.user.id, req.user.role);
    return res.json({ message: "Milestone updated successfully", milestone });
  } catch (error: any) {
    console.error("Update milestone error:", error);
    if (error.message.includes("Invalid") || error.message.includes("belong") || error.message.includes("exceed")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === "Milestone not found") return res.status(404).json({ message: error.message });
    if (error.message === "Forbidden") return res.status(403).json({ message: "Only the project engineer, assigned supervisor, or admin can update this milestone" });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteMilestone = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    if (!id) return res.status(400).json({ message: "Milestone ID is required" });

    await MilestoneService.deleteMilestone(id, req.user.id, req.user.role);
    return res.json({ message: "Milestone deleted successfully" });
  } catch (error: any) {
    console.error("Delete milestone error:", error);
    if (error.message === "Milestone not found") return res.status(404).json({ message: error.message });
    if (error.message === "Forbidden") return res.status(403).json({ message: "Only the milestone engineer or admin can delete this milestone" });
    if (error.message.includes("dependent")) return res.status(400).json({ message: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

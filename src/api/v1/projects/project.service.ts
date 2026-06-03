/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : project.service.ts
 * WHAT THIS FILE DOES : Handles database logic, permissions, and media uploads for Projects
 * HOW IT DOES IT      : Connects to Prisma ORM and Cloudinary APIs; validates role permissions
 * DATA SOURCE         : Controller parameters (parsed request parameters and file streams)
 * DATA DESTINATION    : Prisma PostgreSQL Database + Cloudinary file hosting
 * PRINCIPLE APPLIED   : SOLID (Business and Data isolation service)
 * ============================================================================
 */

import { UploadApiResponse } from "cloudinary";
import { Prisma, ProjectStatus } from "@prisma/client";
import cloudinary from "../../../config/cloudinary.js";
import prisma from "../../../config/db.js";

export type ProjectMediaCollection = "sitePhotos" | "architecturalPlans";

export type ProjectMediaItem = {
  cloudinaryUrl: string;
  publicId: string;
};

/**
 * 🧱 CODE BLOCK: Cloudinary Helper Utilities
 * WHAT IT IS DOING: Manages upload/delete streams to Cloudinary servers
 * WHY IT IS HERE  : Centralized file storage driver for site photos and construction blueprints
 * PRINCIPLE       : KISS
 */
const uploadImage = (file: Express.Multer.File, folder: string) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });

const parseJsonField = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const getProjectMediaFolder = (collection: ProjectMediaCollection) =>
  collection === "architecturalPlans"
    ? "inkingi/projects/architectural-plans"
    : "inkingi/projects/site-photos";

const getProjectMediaItems = (value: Prisma.JsonValue | null | undefined): ProjectMediaItem[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ProjectMediaItem => {
    return (
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      "cloudinaryUrl" in item &&
      "publicId" in item &&
      typeof item.cloudinaryUrl === "string" &&
      typeof item.publicId === "string"
    );
  });
};

const uploadProjectFiles = async (files: Express.Multer.File[]) => {
  const sitePhotoFiles = files.filter((f) => f.fieldname !== "architecturalPlans");
  const architecturalPlanFiles = files.filter((f) => f.fieldname === "architecturalPlans");

  const [sitePhotoUploads, architecturalPlanUploads] = await Promise.all([
    Promise.all(sitePhotoFiles.map((file) => uploadImage(file, "inkingi/projects/site-photos"))),
    Promise.all(architecturalPlanFiles.map((file) => uploadImage(file, "inkingi/projects/architectural-plans"))),
  ]);

  return {
    sitePhotos: sitePhotoUploads.map((photo) => ({
      cloudinaryUrl: photo.secure_url,
      publicId: photo.public_id,
    })),
    architecturalPlans: architecturalPlanUploads.map((plan) => ({
      cloudinaryUrl: plan.secure_url,
      publicId: plan.public_id,
    })),
  };
};

const deleteCloudinaryFiles = async (publicIds: string[]) => {
  if (publicIds.length === 0) return;
  await Promise.allSettled(publicIds.map((id) => cloudinary.uploader.destroy(id)));
};

/**
 * 🧱 CODE BLOCK: Permission Evaluators
 * WHAT IT IS DOING: Assesses if an engineer or client owns/has member access to a project
 * WHY IT IS HERE  : Secures read/update operations against unauthorized external edits
 * PRINCIPLE       : SOLID
 */
const canReadProject = (project: any, userId: string, role: string) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "admin") return true;
  if (project.clientId === userId) return true;
  if (project.engineerId === userId) return true;
  return Boolean(
    project.projectMembers?.some(
      (m: any) =>
        m.userId === userId &&
        m.status === "accepted" &&
        (normalizedRole === "admin" || String(m.role).toLowerCase() === normalizedRole),
    ),
  );
};

const canUpdateProject = (project: any, userId: string, role: string) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "admin") return true;
  if (normalizedRole === "client") return project.clientId === userId;
  if (normalizedRole === "engineer") return project.engineerId === userId;
  return false;
};

const projectListInclude = {
  client: {
    select: { id: true, name: true, email: true, role: true, image: true },
  },
  engineer: {
    select: { id: true, name: true, email: true, role: true, image: true },
  },
  projectMembers: {
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, image: true },
      },
    },
  },
  milestones: true,
  escrowAccount: true,
};

export class ProjectService {
  /**
   * ============================================================================
   * 🔧 FUNCTION: createProject
   * ============================================================================
   * WHAT IT DOES: Adds a new project record and uploads attached images
   * PARAMETERS:
   *   - userId (string) : Client owner ID
   *   - body (any) : Input parameters
   *   - files (Express.Multer.File[]) : Files uploaded through request
   * RETURNS: Promise<any> - Generated project record
   * ============================================================================
   */
  static async createProject(userId: string, body: any, files: Express.Multer.File[]) {
    const {
      name,
      description,
      category,
      status,
      budget,
      currency,
      address,
      area,
      upi,
      ownerName,
      landUse,
      gpsBoundary,
      architecturalPlans,
      startDate,
      endDate,
      engineerId,
    } = body;

    if (!name || !budget) {
      throw new Error("Missing required fields (name, budget)");
    }

    const uploaded = await uploadProjectFiles(files);
    const bodyArchitecturalPlans = parseJsonField(architecturalPlans);

    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          description,
          category: category || undefined,
          status,
          budget,
          currency,
          address,
          area: area !== undefined && area !== "" ? area : undefined,
          upi: upi || undefined,
          ownerName: ownerName || undefined,
          landUse: landUse || undefined,
          gpsBoundary: parseJsonField(gpsBoundary),
          sitePhotos: uploaded.sitePhotos,
          architecturalPlans:
            uploaded.architecturalPlans.length > 0
              ? uploaded.architecturalPlans
              : bodyArchitecturalPlans || [],
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          clientId: userId,
          engineerId: engineerId || undefined,
        },
      });

      await tx.escrowAccount.create({
        data: {
          projectId: project.id,
          currency: currency || "RWF",
        },
      });

      return await tx.project.findUniqueOrThrow({
        where: { id: project.id },
        include: projectListInclude,
      });
    });
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: getProjects
   * ============================================================================
   * WHAT IT DOES: Lists all projects relevant to user's permissions and role
   * ============================================================================
   */
  static async getProjects(role: string, userId: string) {
    const normalizedRole = String(role || "").trim().toLowerCase();

    if (normalizedRole === "client") {
      return await prisma.project.findMany({
        where: { clientId: userId },
        include: projectListInclude,
        orderBy: { createdAt: "desc" },
      });
    } else if (normalizedRole === "engineer") {
      return await prisma.project.findMany({
        where: {
          OR: [
            { engineerId: userId },
            { projectMembers: { some: { userId, role: "engineer", status: "accepted" } } },
          ],
        },
        include: projectListInclude,
        orderBy: { createdAt: "desc" },
      });
    } else if (normalizedRole === "supervisor" || normalizedRole === "supplier") {
      return await prisma.project.findMany({
        where: { projectMembers: { some: { userId, role: normalizedRole, status: "accepted" } } },
        include: projectListInclude,
        orderBy: { createdAt: "desc" },
      });
    }
    return await prisma.project.findMany({
      include: projectListInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: getProjectById
   * ============================================================================
   * WHAT IT DOES: Fetches a single project with nested relations if permissions match
   * ============================================================================
   */
  static async getProjectById(projectId: string, userId: string, role: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        engineer: true,
        projectMembers: true,
        milestones: true,
        escrowAccount: true,
      },
    });

    if (!project) throw new Error("Project not found");
    if (!canReadProject(project, userId, role)) throw new Error("Forbidden");

    return project;
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: updateProject
   * ============================================================================
   * WHAT IT DOES: Modifies non-key fields of a project and uploads additional assets
   * ============================================================================
   */
  static async updateProject(projectId: string, userId: string, role: string, body: any, files: Express.Multer.File[]) {
    const existing = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existing) throw new Error("Project not found");
    if (!canUpdateProject(existing, userId, role)) throw new Error("Forbidden");

    const uploaded = await uploadProjectFiles(files);

    const updateData: Prisma.ProjectUpdateInput = {};
    if (body.name !== undefined) updateData.name = String(body.name);
    if (body.description !== undefined) updateData.description = String(body.description);
    if (body.category !== undefined) updateData.category = String(body.category);
    if (body.status !== undefined) updateData.status = body.status as any;
    if (body.budget !== undefined) updateData.budget = String(body.budget);
    if (body.currency !== undefined) updateData.currency = String(body.currency);
    if (body.address !== undefined) updateData.address = String(body.address);
    if (body.area !== undefined) updateData.area = String(body.area);
    if (body.upi !== undefined) updateData.upi = String(body.upi);
    if (body.ownerName !== undefined) updateData.ownerName = String(body.ownerName);
    if (body.landUse !== undefined) updateData.landUse = String(body.landUse);
    if (body.gpsBoundary !== undefined) updateData.gpsBoundary = parseJsonField(body.gpsBoundary);
    if (body.startDate !== undefined) updateData.startDate = new Date(String(body.startDate));
    if (body.endDate !== undefined) updateData.endDate = new Date(String(body.endDate));
    if (body.engineerId !== undefined) {
      updateData.engineer = body.engineerId ? { connect: { id: String(body.engineerId) } } : { disconnect: true };
    }

    const bodySitePhotos = parseJsonField(body.sitePhotos);
    const bodyArchitecturalPlans = parseJsonField(body.architecturalPlans);

    if (uploaded.sitePhotos.length > 0) {
      updateData.sitePhotos = [
        ...(Array.isArray(existing.sitePhotos) ? existing.sitePhotos : []),
        ...uploaded.sitePhotos,
      ];
    } else if (bodySitePhotos !== undefined) {
      updateData.sitePhotos = bodySitePhotos as Prisma.InputJsonValue;
    }

    if (uploaded.architecturalPlans.length > 0) {
      updateData.architecturalPlans = [
        ...(Array.isArray(existing.architecturalPlans) ? existing.architecturalPlans : []),
        ...uploaded.architecturalPlans,
      ];
    } else if (bodyArchitecturalPlans !== undefined) {
      updateData.architecturalPlans = bodyArchitecturalPlans as Prisma.InputJsonValue;
    }

    return await prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: toggleProjectStatus
   * ============================================================================
   * WHAT IT DOES: Adjusts or switches the status string of a project
   * ============================================================================
   */
  static async toggleProjectStatus(projectId: string, userId: string, role: string, requestedStatus?: string) {
    const existing = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existing) throw new Error("Project not found");
    if (!canUpdateProject(existing, userId, role)) throw new Error("Forbidden");

    if (requestedStatus && !Object.values(ProjectStatus).includes(requestedStatus as ProjectStatus)) {
      throw new Error("Invalid project status");
    }

    let status: ProjectStatus;
    if (requestedStatus) {
      status = requestedStatus as ProjectStatus;
    } else {
      const statuses = Object.values(ProjectStatus);
      const currentIndex = statuses.indexOf(existing.status);
      const nextIndex = currentIndex === statuses.length - 1 ? 0 : currentIndex + 1;
      status = statuses[nextIndex];
    }

    return await prisma.project.update({
      where: { id: projectId },
      data: { status },
    });
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: changeProjectImage
   * ============================================================================
   * WHAT IT DOES: Replaces one image from site photos or blueprints in Cloudinary and DB
   * ============================================================================
   */
  static async changeProjectImage(
    projectId: string,
    userId: string,
    role: string,
    collection: ProjectMediaCollection,
    publicId: string,
    file: Express.Multer.File
  ) {
    const existing = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existing) throw new Error("Project not found");
    if (!canUpdateProject(existing, userId, role)) throw new Error("Forbidden");

    const media = getProjectMediaItems(existing[collection]);
    const idx = media.findIndex((m) => m.publicId === publicId);
    if (idx === -1) throw new Error("Project image not found");

    const uploaded = await uploadImage(file, getProjectMediaFolder(collection));
    const oldPublicId = media[idx].publicId;

    media[idx] = {
      cloudinaryUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
    };

    const project = await prisma.project.update({
      where: { id: projectId },
      data: collection === "sitePhotos" ? { sitePhotos: media } : { architecturalPlans: media },
    });

    await deleteCloudinaryFiles([oldPublicId]);
    return project;
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: deleteProjectImage
   * ============================================================================
   * WHAT IT DOES: Deletes one image from site photos or plans in Cloudinary and DB
   * ============================================================================
   */
  static async deleteProjectImage(
    projectId: string,
    userId: string,
    role: string,
    collection: ProjectMediaCollection,
    publicId: string
  ) {
    const existing = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existing) throw new Error("Project not found");
    if (!canUpdateProject(existing, userId, role)) throw new Error("Forbidden");

    const media = getProjectMediaItems(existing[collection]);
    const imageExists = media.some((m) => m.publicId === publicId);
    if (!imageExists) throw new Error("Project image not found");

    const updatedMedia = media.filter((m) => m.publicId !== publicId);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: collection === "sitePhotos" ? { sitePhotos: updatedMedia } : { architecturalPlans: updatedMedia },
    });

    await deleteCloudinaryFiles([publicId]);
    return project;
  }

  /**
   * ============================================================================
   * 🔧 FUNCTION: deleteProject
   * ============================================================================
   * WHAT IT DOES: Removes a project and all associated Cloudinary photos from hosts
   * ============================================================================
   */
  static async deleteProject(projectId: string, userId: string, role: string) {
    const existing = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existing) throw new Error("Project not found");
    if (role !== "admin" && existing.clientId !== userId) throw new Error("Forbidden");

    const sitePhotos = getProjectMediaItems(existing.sitePhotos);
    const plans = getProjectMediaItems(existing.architecturalPlans);
    const publicIds = [...sitePhotos, ...plans].map((item) => item.publicId);

    await prisma.project.delete({ where: { id: projectId } });
    await deleteCloudinaryFiles(publicIds);
  }
}

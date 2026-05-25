import { Request, Response } from "express";
import { UploadApiResponse } from "cloudinary";
import { Prisma } from "@prisma/client";
import cloudinary from "../../../lib/cloudinary.js";
import prisma from "../../../lib/prisma.js";
import { notifyProjectParticipants } from "../../../lib/notifications.js";

const getParamId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const uploadMedia = (file: Express.Multer.File) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "inkingi/projects/progress",
        resource_type: file.mimetype.startsWith("video/") ? "video" : "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );

    stream.end(file.buffer);
  });

const deleteCloudinaryFile = async (publicId: string, isVideo?: boolean) => {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: isVideo ? "video" : "image",
  });
};

const parseJsonField = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value !== "string") return value as Prisma.InputJsonValue;

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return value;
  }
};

const canReadProject = (
  project: {
    clientId: string;
    engineerId: string | null;
    projectMembers?: { userId: string; status: string }[];
  },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  if (project.clientId === userId) return true;
  if (project.engineerId === userId) return true;
  return Boolean(
    project.projectMembers?.some(
      (member) => member.userId === userId && member.status === "accepted",
    ),
  );
};

const canUploadProgress = (
  project: {
    engineerId: string | null;
    projectMembers?: { userId: string; role: string; status: string }[];
  },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  if (role === "engineer") return project.engineerId === userId;
  if (role === "supervisor") {
    return Boolean(
      project.projectMembers?.some(
        (member) =>
          member.userId === userId &&
          member.role === "supervisor" &&
          member.status === "accepted",
      ),
    );
  }
  return false;
};

const canManageProgressPhoto = (
  photo: {
    uploadedById: string;
    project: {
      engineerId: string | null;
      projectMembers?: { userId: string; role: string; status: string }[];
    };
  },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  if (photo.uploadedById === userId) return true;
  return canUploadProgress(photo.project, userId, role);
};

export const createProgressPhoto = async (req: Request, res: Response) => {
  try {
    const { projectId, milestoneId, gpsLocation, caption, videoDuration } =
      req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    if (files.length === 0) {
      return res.status(400).json({ message: "At least one file is required" });
    }

    const project = await prisma.project.findUnique({
      where: { id: String(projectId) },
      include: {
        projectMembers: true,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!canUploadProgress(project, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only the project engineer, assigned supervisor, or admin can upload progress media",
      });
    }

    if (milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: {
          id: String(milestoneId),
          projectId: project.id,
        },
      });

      if (!milestone) {
        return res.status(400).json({
          message: "milestoneId must belong to the same project",
        });
      }
    }

    const uploads = await Promise.all(files.map((file) => uploadMedia(file)));

    const progressPhotos = await Promise.all(
      uploads.map((upload, index) => {
        const file = files[index];
        const isVideo = file.mimetype.startsWith("video/");

        return prisma.progressPhoto.create({
          data: {
            projectId: project.id,
            milestoneId: milestoneId || undefined,
            uploadedById: req.user.id,
            cloudinaryUrl: upload.secure_url,
            publicId: upload.public_id,
            gpsLocation: parseJsonField(gpsLocation),
            caption,
            isVideo,
            videoDuration:
              videoDuration !== undefined ? Number(videoDuration) : undefined,
          },
          include: {
            project: true,
            milestone: true,
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
              },
            },
          },
        });
      }),
    );

    await notifyProjectParticipants({
      projectId: project.id,
      excludeUserId: req.user.id,
      title: "Progress uploaded",
      body: `${req.user.name} uploaded ${progressPhotos.length} progress item(s)`,
      data: {
        milestoneId: milestoneId || undefined,
        type: "progress_uploaded",
      },
    });

    return res.status(201).json({
      message: "Progress media uploaded successfully",
      progressPhotos,
    });
  } catch (error) {
    console.error("Create progress photo error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProgressPhotos = async (req: Request, res: Response) => {
  try {
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const milestoneId =
      typeof req.query.milestoneId === "string"
        ? req.query.milestoneId
        : undefined;

    const progressPhotos = await prisma.progressPhoto.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(milestoneId ? { milestoneId } : {}),
        ...(req.user.role === "admin"
          ? {}
          : {
              project: {
                OR: [
                  { clientId: req.user.id },
                  { engineerId: req.user.id },
                  {
                    projectMembers: {
                      some: {
                        userId: req.user.id,
                        status: "accepted",
                      },
                    },
                  },
                ],
              },
            }),
      },
      include: {
        project: true,
        milestone: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json(progressPhotos);
  } catch (error) {
    console.error("Get progress photos error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProgressPhotoById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Progress photo ID is required" });
    }

    const progressPhoto = await prisma.progressPhoto.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
        milestone: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    });

    if (!progressPhoto) {
      return res.status(404).json({ message: "Progress photo not found" });
    }

    if (!canReadProject(progressPhoto.project, req.user.id, req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(progressPhoto);
  } catch (error) {
    console.error("Get progress photo by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProgressPhoto = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { milestoneId, gpsLocation, caption, videoDuration } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];
    const file = files[0];

    if (!id) {
      return res.status(400).json({ message: "Progress photo ID is required" });
    }

    const existingPhoto = await prisma.progressPhoto.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
      },
    });

    if (!existingPhoto) {
      return res.status(404).json({ message: "Progress photo not found" });
    }

    if (!canManageProgressPhoto(existingPhoto, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only the uploader, project engineer, assigned supervisor, or admin can update this media",
      });
    }

    if (milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: {
          id: String(milestoneId),
          projectId: existingPhoto.projectId,
        },
      });

      if (!milestone) {
        return res.status(400).json({
          message: "milestoneId must belong to the same project",
        });
      }
    }

    const data: Prisma.ProgressPhotoUpdateInput = {};
    let oldPublicId: string | null = null;
    let oldWasVideo = false;

    if (milestoneId !== undefined) {
      data.milestone = milestoneId
        ? { connect: { id: String(milestoneId) } }
        : { disconnect: true };
    }
    if (gpsLocation !== undefined) data.gpsLocation = parseJsonField(gpsLocation);
    if (caption !== undefined) data.caption = caption ? String(caption) : null;
    if (videoDuration !== undefined) {
      data.videoDuration = videoDuration ? Number(videoDuration) : null;
    }

    if (file) {
      const uploaded = await uploadMedia(file);
      oldPublicId = existingPhoto.publicId;
      oldWasVideo = existingPhoto.isVideo;
      data.cloudinaryUrl = uploaded.secure_url;
      data.publicId = uploaded.public_id;
      data.isVideo = file.mimetype.startsWith("video/");
    }

    const progressPhoto = await prisma.progressPhoto.update({
      where: { id },
      data,
      include: {
        project: true,
        milestone: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    });

    if (oldPublicId) {
      await deleteCloudinaryFile(oldPublicId, oldWasVideo);
    }

    return res.json({
      message: "Progress media updated successfully",
      progressPhoto,
    });
  } catch (error) {
    console.error("Update progress photo error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteProgressPhoto = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Progress photo ID is required" });
    }

    const progressPhoto = await prisma.progressPhoto.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
      },
    });

    if (!progressPhoto) {
      return res.status(404).json({ message: "Progress photo not found" });
    }

    if (!canManageProgressPhoto(progressPhoto, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only the uploader, project engineer, assigned supervisor, or admin can delete this media",
      });
    }

    await prisma.progressPhoto.delete({
      where: { id },
    });

    await deleteCloudinaryFile(progressPhoto.publicId, progressPhoto.isVideo);

    return res.json({ message: "Progress media deleted successfully" });
  } catch (error) {
    console.error("Delete progress photo error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

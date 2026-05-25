import { Request, Response } from "express";
import { InspectionDecision, Prisma } from "@prisma/client";
import { UploadApiResponse } from "cloudinary";
import cloudinary from "../../../lib/cloudinary.js";
import prisma from "../../../lib/prisma.js";

type InspectionPhoto = {
  cloudinaryUrl: string;
  publicId: string;
};

const getParamId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const parseJsonField = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value !== "string") return value as Prisma.InputJsonValue;

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return value;
  }
};

const isInspectionDecision = (
  value: unknown,
): value is InspectionDecision =>
  typeof value === "string" &&
  Object.values(InspectionDecision).includes(value as InspectionDecision);

const uploadImage = (file: Express.Multer.File, folder: string) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
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

const getInspectionFiles = (files: Express.Multer.File[]) => {
  const signatureFile = files.find((file) => file.fieldname === "signature");
  const photoFiles = files.filter((file) => file.fieldname !== "signature");

  return { signatureFile, photoFiles };
};

const getInspectionPhotos = (
  value: Prisma.JsonValue | null | undefined,
): InspectionPhoto[] => {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is InspectionPhoto => {
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

const deleteCloudinaryFiles = async (publicIds: string[]) => {
  if (publicIds.length === 0) return;

  await Promise.allSettled(
    publicIds.map((publicId) => cloudinary.uploader.destroy(publicId)),
  );
};

const canReadMilestoneInspection = (
  milestone: {
    project: {
      clientId: string;
      engineerId: string | null;
      projectMembers?: { userId: string; status: string }[];
    };
  },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  if (milestone.project.clientId === userId) return true;
  if (milestone.project.engineerId === userId) return true;
  return Boolean(
    milestone.project.projectMembers?.some(
      (member) => member.userId === userId && member.status === "accepted",
    ),
  );
};

const canInspectMilestone = (
  milestone: {
    project: {
      projectMembers?: { userId: string; role: string; status: string }[];
    };
  },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  if (role !== "supervisor") return false;

  return Boolean(
    milestone.project.projectMembers?.some(
      (member) =>
        member.userId === userId &&
        member.role === "supervisor" &&
        member.status === "accepted",
    ),
  );
};

const milestoneStatusForDecision = (decision?: InspectionDecision) => {
  if (decision === "approved") return "awaiting_client_payment";
  if (decision === "revision_required") return "revision_required";
  return undefined;
};

const buildInspectionUpdateData = (
  body: Record<string, unknown>,
  uploadedPhotos: InspectionPhoto[],
  signatureUrl?: string,
  existingPhotos: InspectionPhoto[] = [],
) => {
  const data: Prisma.InspectionUpdateInput = {};

  if (body.checklist !== undefined) data.checklist = parseJsonField(body.checklist);
  if (uploadedPhotos.length > 0) data.photos = [...existingPhotos, ...uploadedPhotos];
  if (body.photos !== undefined && uploadedPhotos.length === 0) {
    data.photos = parseJsonField(body.photos);
  }
  if (body.rating !== undefined) {
    data.rating = body.rating ? Number(body.rating) : null;
  }
  if (signatureUrl) data.signatureUrl = signatureUrl;
  if (body.signatureUrl !== undefined && !signatureUrl) {
    data.signatureUrl = body.signatureUrl ? String(body.signatureUrl) : null;
  }
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.decision !== undefined) {
    data.decision = body.decision as InspectionDecision;
    data.signedAt = new Date();
  }
  if (body.attemptNumber !== undefined) {
    data.attemptNumber = Number(body.attemptNumber);
  }

  return data;
};

export const createInspection = async (req: Request, res: Response) => {
  try {
    const {
      milestoneId,
      checklist,
      rating,
      notes,
      decision,
      attemptNumber,
    } = req.body;

    if (!milestoneId) {
      return res.status(400).json({ message: "milestoneId is required" });
    }

    if (decision !== undefined && !isInspectionDecision(decision)) {
      return res.status(400).json({ message: "Invalid inspection decision" });
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: String(milestoneId) },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
        inspections: true,
      },
    });

    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    if (!canInspectMilestone(milestone, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only an assigned supervisor or admin can inspect this milestone",
      });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const { signatureFile, photoFiles } = getInspectionFiles(files);
    const [photoUploads, signatureUpload] = await Promise.all([
      Promise.all(
        photoFiles.map((file) =>
          uploadImage(file, "inkingi/inspections/photos"),
        ),
      ),
      signatureFile
        ? uploadImage(signatureFile, "inkingi/inspections/signatures")
        : Promise.resolve(null),
    ]);

    const photos = photoUploads.map((photo) => ({
      cloudinaryUrl: photo.secure_url,
      publicId: photo.public_id,
    }));
    const nextMilestoneStatus = milestoneStatusForDecision(decision);

    const inspection = await prisma.$transaction(async (tx) => {
      const createdInspection = await tx.inspection.create({
        data: {
          milestoneId: milestone.id,
          supervisorId: req.user.id,
          checklist: parseJsonField(checklist) || {},
          photos,
          rating: rating !== undefined ? Number(rating) : undefined,
          signatureUrl: signatureUpload?.secure_url,
          notes,
          decision,
          attemptNumber:
            attemptNumber !== undefined
              ? Number(attemptNumber)
              : milestone.inspections.length + 1,
          signedAt: decision ? new Date() : undefined,
        },
        include: {
          milestone: {
            include: {
              project: true,
            },
          },
          supervisor: {
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

      if (nextMilestoneStatus) {
        await tx.milestone.update({
          where: { id: milestone.id },
          data: {
            status: nextMilestoneStatus,
            completedAt: decision === "approved" ? new Date() : undefined,
          },
        });
      }

      return createdInspection;
    });

    return res.status(201).json({
      message: "Inspection created successfully",
      inspection,
    });
  } catch (error) {
    console.error("Create inspection error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getInspections = async (req: Request, res: Response) => {
  try {
    const milestoneId =
      typeof req.query.milestoneId === "string"
        ? req.query.milestoneId
        : undefined;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const decision =
      typeof req.query.decision === "string" ? req.query.decision : undefined;

    if (decision !== undefined && !isInspectionDecision(decision)) {
      return res.status(400).json({ message: "Invalid inspection decision" });
    }

    const inspections = await prisma.inspection.findMany({
      where: {
        ...(milestoneId ? { milestoneId } : {}),
        ...(decision ? { decision } : {}),
        ...(projectId ? { milestone: { projectId } } : {}),
        ...(req.user.role === "admin"
          ? {}
          : {
              milestone: {
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
              },
            }),
      },
      include: {
        milestone: {
          include: {
            project: true,
          },
        },
        supervisor: {
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

    return res.json(inspections);
  } catch (error) {
    console.error("Get inspections error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getInspectionById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Inspection ID is required" });
    }

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        milestone: {
          include: {
            project: {
              include: {
                projectMembers: true,
              },
            },
          },
        },
        supervisor: {
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

    if (!inspection) {
      return res.status(404).json({ message: "Inspection not found" });
    }

    if (!canReadMilestoneInspection(inspection.milestone, req.user.id, req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(inspection);
  } catch (error) {
    console.error("Get inspection by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateInspection = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const { decision } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Inspection ID is required" });
    }

    if (decision !== undefined && !isInspectionDecision(decision)) {
      return res.status(400).json({ message: "Invalid inspection decision" });
    }

    const existingInspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        milestone: {
          include: {
            project: {
              include: {
                projectMembers: true,
              },
            },
          },
        },
      },
    });

    if (!existingInspection) {
      return res.status(404).json({ message: "Inspection not found" });
    }

    if (!canInspectMilestone(existingInspection.milestone, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only an assigned supervisor or admin can update this inspection",
      });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const { signatureFile, photoFiles } = getInspectionFiles(files);
    const [photoUploads, signatureUpload] = await Promise.all([
      Promise.all(
        photoFiles.map((file) =>
          uploadImage(file, "inkingi/inspections/photos"),
        ),
      ),
      signatureFile
        ? uploadImage(signatureFile, "inkingi/inspections/signatures")
        : Promise.resolve(null),
    ]);
    const uploadedPhotos = photoUploads.map((photo) => ({
      cloudinaryUrl: photo.secure_url,
      publicId: photo.public_id,
    }));
    const currentPhotos = getInspectionPhotos(existingInspection.photos);
    const nextMilestoneStatus = milestoneStatusForDecision(decision);

    const inspection = await prisma.$transaction(async (tx) => {
      const updatedInspection = await tx.inspection.update({
        where: { id },
        data: buildInspectionUpdateData(
          req.body,
          uploadedPhotos,
          signatureUpload?.secure_url,
          currentPhotos,
        ),
        include: {
          milestone: {
            include: {
              project: true,
            },
          },
          supervisor: {
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

      if (nextMilestoneStatus) {
        await tx.milestone.update({
          where: { id: existingInspection.milestoneId },
          data: {
            status: nextMilestoneStatus,
            completedAt: decision === "approved" ? new Date() : undefined,
          },
        });
      }

      return updatedInspection;
    });

    return res.json({
      message: "Inspection updated successfully",
      inspection,
    });
  } catch (error) {
    console.error("Update inspection error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteInspection = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Inspection ID is required" });
    }

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        milestone: {
          include: {
            project: {
              include: {
                projectMembers: true,
              },
            },
          },
        },
      },
    });

    if (!inspection) {
      return res.status(404).json({ message: "Inspection not found" });
    }

    if (!canInspectMilestone(inspection.milestone, req.user.id, req.user.role)) {
      return res.status(403).json({
        message: "Only an assigned supervisor or admin can delete this inspection",
      });
    }

    await prisma.inspection.delete({
      where: { id },
    });

    await deleteCloudinaryFiles(
      getInspectionPhotos(inspection.photos).map((photo) => photo.publicId),
    );

    return res.json({ message: "Inspection deleted successfully" });
  } catch (error) {
    console.error("Delete inspection error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

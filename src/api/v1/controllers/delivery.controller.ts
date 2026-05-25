import { Request, Response } from "express";
import { DeliveryStatus, Prisma } from "@prisma/client";
import { UploadApiResponse } from "cloudinary";
import cloudinary from "../../../lib/cloudinary.js";
import prisma from "../../../lib/prisma.js";

type ProofPhoto = {
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

const isDeliveryStatus = (value: unknown): value is DeliveryStatus =>
  typeof value === "string" &&
  Object.values(DeliveryStatus).includes(value as DeliveryStatus);

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

const getProofPhotos = (value: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is ProofPhoto => {
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

const canReadDelivery = (
  delivery: {
    supplierId: string;
    purchaseOrder: {
      rfq: {
        engineerId: string;
        project: {
          clientId: string;
          engineerId: string | null;
          projectMembers?: { userId: string; status: string }[];
        };
      };
    };
  },
  userId: string,
  role: string,
) => {
  if (role === "admin") return true;
  if (role === "supplier") return delivery.supplierId === userId;
  if (delivery.purchaseOrder.rfq.engineerId === userId) return true;
  if (delivery.purchaseOrder.rfq.project.clientId === userId) return true;
  if (delivery.purchaseOrder.rfq.project.engineerId === userId) return true;
  return Boolean(
    delivery.purchaseOrder.rfq.project.projectMembers?.some(
      (member) => member.userId === userId && member.status === "accepted",
    ),
  );
};

const getStatusDates = (status?: DeliveryStatus) => ({
  startedAt:
    status === "in_transit" || status === "delivered"
      ? new Date()
      : undefined,
  arrivedAt:
    status === "delivered" || status === "pending_confirmation"
      ? new Date()
      : undefined,
  confirmedAt: status === "confirmed" ? new Date() : undefined,
});

export const createDelivery = async (req: Request, res: Response) => {
  try {
    const {
      purchaseOrderId,
      status,
      startGps,
      endGps,
      notes,
      rejectionReason,
    } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    if (!purchaseOrderId) {
      return res.status(400).json({ message: "purchaseOrderId is required" });
    }

    if (status !== undefined && !isDeliveryStatus(status)) {
      return res.status(400).json({ message: "Invalid delivery status" });
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: String(purchaseOrderId) },
      include: {
        deliveries: true,
      },
    });

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    if (purchaseOrder.supplierId !== req.user.id) {
      return res.status(403).json({
        message: "Only the purchase order supplier can create delivery",
      });
    }

    if (purchaseOrder.status !== "accepted") {
      return res.status(400).json({
        message: "Purchase order must be accepted before delivery starts",
        currentStatus: purchaseOrder.status,
      });
    }

    const activeDelivery = purchaseOrder.deliveries.find(
      (delivery) =>
        delivery.status !== "confirmed" && delivery.status !== "rejected",
    );

    if (activeDelivery) {
      return res.status(409).json({
        message: "Purchase order already has an active delivery",
        delivery: activeDelivery,
      });
    }

    const uploads = await Promise.all(
      files.map((file) => uploadImage(file, "inkingi/procurement/deliveries")),
    );
    const proofPhotos = uploads.map((upload) => ({
      cloudinaryUrl: upload.secure_url,
      publicId: upload.public_id,
    }));
    const nextStatus = status || "preparing";

    const delivery = await prisma.delivery.create({
      data: {
        purchaseOrderId: purchaseOrder.id,
        supplierId: req.user.id,
        status: nextStatus,
        startGps: parseJsonField(startGps),
        endGps: parseJsonField(endGps),
        proofPhotos,
        notes,
        rejectionReason,
        ...getStatusDates(nextStatus),
      },
      include: {
        purchaseOrder: {
          include: {
            rfq: {
              include: {
                project: true,
                milestone: true,
              },
            },
            quote: true,
          },
        },
        supplier: {
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

    return res.status(201).json({
      message: "Delivery created successfully",
      delivery,
    });
  } catch (error) {
    console.error("Create delivery error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getDeliverys = async (req: Request, res: Response) => {
  try {
    const purchaseOrderId =
      typeof req.query.purchaseOrderId === "string"
        ? req.query.purchaseOrderId
        : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    if (status !== undefined && !isDeliveryStatus(status)) {
      return res.status(400).json({ message: "Invalid delivery status" });
    }

    const deliveries = await prisma.delivery.findMany({
      where: {
        ...(purchaseOrderId ? { purchaseOrderId } : {}),
        ...(status ? { status } : {}),
        ...(req.user.role === "supplier"
          ? { supplierId: req.user.id }
          : req.user.role === "admin"
            ? {}
            : {
                purchaseOrder: {
                  rfq: {
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
                },
              }),
      },
      include: {
        purchaseOrder: {
          include: {
            rfq: {
              include: {
                project: true,
                milestone: true,
              },
            },
            quote: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(deliveries);
  } catch (error) {
    console.error("Get deliveries error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getDeliveryById = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Delivery ID is required" });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            rfq: {
              include: {
                project: {
                  include: {
                    projectMembers: true,
                  },
                },
                milestone: true,
              },
            },
            quote: true,
          },
        },
        supplier: {
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

    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    if (!canReadDelivery(delivery, req.user.id, req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(delivery);
  } catch (error) {
    console.error("Get delivery by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateDelivery = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);
    const {
      status,
      startGps,
      endGps,
      proofPhotos,
      notes,
      rejectionReason,
    } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    if (!id) {
      return res.status(400).json({ message: "Delivery ID is required" });
    }

    if (status !== undefined && !isDeliveryStatus(status)) {
      return res.status(400).json({ message: "Invalid delivery status" });
    }

    const existingDelivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            rfq: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (!existingDelivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    const supplierUpdating =
      req.user.role === "supplier" && existingDelivery.supplierId === req.user.id;
    const projectApproving =
      req.user.role === "admin" ||
      existingDelivery.purchaseOrder.rfq.project.clientId === req.user.id ||
      existingDelivery.purchaseOrder.rfq.engineerId === req.user.id;

    if (!supplierUpdating && !projectApproving) {
      return res.status(403).json({
        message:
          "Only supplier can update delivery progress, and client, engineer or admin can confirm or reject delivery",
      });
    }

    if (
      supplierUpdating &&
      (status === "confirmed" || status === "rejected")
    ) {
      return res.status(403).json({
        message: "Supplier cannot confirm or reject delivery",
      });
    }

    if (
      projectApproving &&
      status &&
      status !== "confirmed" &&
      status !== "rejected" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Client or engineer can only confirm or reject delivery",
      });
    }

    const uploads = await Promise.all(
      files.map((file) => uploadImage(file, "inkingi/procurement/deliveries")),
    );
    const uploadedProofPhotos = uploads.map((upload) => ({
      cloudinaryUrl: upload.secure_url,
      publicId: upload.public_id,
    }));
    const existingProofPhotos = getProofPhotos(existingDelivery.proofPhotos);

    const delivery = await prisma.$transaction(async (tx) => {
      const updatedDelivery = await tx.delivery.update({
        where: { id },
        data: {
          status,
          startGps:
            startGps !== undefined ? parseJsonField(startGps) : undefined,
          endGps: endGps !== undefined ? parseJsonField(endGps) : undefined,
          proofPhotos:
            uploadedProofPhotos.length > 0
              ? [...existingProofPhotos, ...uploadedProofPhotos]
              : proofPhotos !== undefined
                ? parseJsonField(proofPhotos)
                : undefined,
          notes,
          rejectionReason:
            rejectionReason !== undefined ? rejectionReason : undefined,
          ...getStatusDates(status),
        },
        include: {
          purchaseOrder: {
            include: {
              rfq: {
                include: {
                  project: true,
                  milestone: true,
                },
              },
              quote: true,
            },
          },
          supplier: {
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

      if (status === "confirmed") {
        await tx.purchaseOrder.update({
          where: { id: existingDelivery.purchaseOrderId },
          data: {
            status: "completed",
            completedAt: new Date(),
          },
        });
      }

      return updatedDelivery;
    });

    return res.json({
      message: "Delivery updated successfully",
      delivery,
    });
  } catch (error) {
    console.error("Update delivery error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteDelivery = async (req: Request, res: Response) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Delivery ID is required" });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id },
    });

    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    if (req.user.role !== "admin" && delivery.supplierId !== req.user.id) {
      return res.status(403).json({
        message: "Only the delivery supplier or admin can delete delivery",
      });
    }

    if (delivery.status === "confirmed") {
      return res.status(400).json({
        message: "Confirmed delivery cannot be deleted",
      });
    }

    await prisma.delivery.delete({
      where: { id },
    });

    return res.json({ message: "Delivery deleted successfully" });
  } catch (error) {
    console.error("Delete delivery error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

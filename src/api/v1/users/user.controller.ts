import { Request, Response } from "express";
import { UploadApiResponse } from "cloudinary";
import { KycDocumentType, KycStatus, Prisma } from "@prisma/client";
import prisma from "../../../config/db.js";
import { hashPassword } from "../../../utils/password.js";
import cloudinary from "../../../config/cloudinary.js";

const getId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

const uploadImage = (file: Express.Multer.File, folder: string) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve(result);
      },
    );

    stream.end(file.buffer);
  });

const parseJson = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value !== "string") return value as Prisma.InputJsonValue;

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return value;
  }
};

const isKycStatus = (value: unknown): value is KycStatus =>
  typeof value === "string" &&
  Object.values(KycStatus).includes(value as KycStatus);

const isKycDocumentType = (value: unknown): value is KycDocumentType =>
  typeof value === "string" &&
  Object.values(KycDocumentType).includes(value as KycDocumentType);

const getDocumentPublicId = (document: Record<string, unknown>) => {
  const publicId = document.publicId || document.id || document.fileName || document.url;
  return publicId ? String(publicId) : `registration-${Date.now()}`;
};

const getDocumentUrl = (document: Record<string, unknown>) => {
  const url = document.url || document.cloudinaryUrl || document.uri;
  return url ? String(url) : undefined;
};

const upsertRegistrationDocuments = async (
  userId: string,
  documents: unknown,
) => {
  const parsedDocuments = parseJson(documents);
  if (!Array.isArray(parsedDocuments)) return;

  await Promise.all(
    parsedDocuments.map(async (document) => {
      if (!document || typeof document !== "object" || Array.isArray(document)) return;

      const typedDocument = document as Record<string, unknown>;
      const type = typedDocument.type;
      const cloudinaryUrl = getDocumentUrl(typedDocument);

      if (!isKycDocumentType(type) || !cloudinaryUrl) return;

      const existing = await prisma.kycDocument.findFirst({
        where: { userId, type },
        select: { id: true },
      });

      await prisma.kycDocument.upsert({
        where: { id: existing?.id ?? "new" },
        update: {
          cloudinaryUrl,
          publicId: getDocumentPublicId(typedDocument),
          status: "pending",
        },
        create: {
          userId,
          type,
          cloudinaryUrl,
          publicId: getDocumentPublicId(typedDocument),
        },
      });
    }),
  );
};

const allowedSelfRoles = ["client", "engineer", "supervisor", "supplier"];

const selectUser = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  role: true,
  banned: true,
  banReason: true,
  banExpires: true,
  username: true,
  displayUsername: true,
  phoneNumber: true,
  phoneNumberVerified: true,
  fcmToken: true,
  kycStatus: true,
  kycSubmittedAt: true,
  kycReviewedAt: true,
  kycRejectionReason: true,
  roleSpecific: true,
  registrationDocuments: true,
  selfieUrl: true,
  registrationSubmittedAt: true,
  lastLoginAt: true,
  notificationPrefs: true,
  createdAt: true,
  updatedAt: true,
  kycDocuments: true,
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: selectUser,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateCurrentUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      image,
      role,
      username,
      displayUsername,
      phoneNumber,
      fcmToken,
      notificationPrefs,
      roleSpecific,
      documents,
      selfieUrl,
      kycStatus,
    } = req.body;

    const nextRole =
      typeof role === "string" ? role.trim().toLowerCase() : undefined;

    if (nextRole && !allowedSelfRoles.includes(nextRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (kycStatus !== undefined && !isKycStatus(kycStatus)) {
      return res.status(400).json({ message: "Invalid KYC status" });
    }

    const parsedRoleSpecific = parseJson(roleSpecific);
    const parsedDocuments = parseJson(documents);
    const nextKycStatus =
      kycStatus === "pending" ? "submitted" : kycStatus;
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const uploadedProfileImage = files[0]
      ? await uploadImage(files[0], "inkingi/users/profile-images")
      : null;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        image: uploadedProfileImage?.secure_url || image,
        role: nextRole,
        username,
        displayUsername,
        phoneNumber,
        fcmToken,
        notificationPrefs:
          notificationPrefs !== undefined
            ? parseJson(notificationPrefs) || {}
            : undefined,
        roleSpecific:
          roleSpecific !== undefined ? parsedRoleSpecific || {} : undefined,
        registrationDocuments:
          documents !== undefined ? parsedDocuments || [] : undefined,
        selfieUrl:
          selfieUrl !== undefined
            ? selfieUrl
              ? String(selfieUrl)
              : null
            : parsedRoleSpecific &&
                typeof parsedRoleSpecific === "object" &&
                !Array.isArray(parsedRoleSpecific) &&
                "selfieUri" in parsedRoleSpecific
              ? String((parsedRoleSpecific as Record<string, unknown>).selfieUri || "")
              : undefined,
        kycStatus: nextKycStatus,
        kycSubmittedAt:
          documents !== undefined || roleSpecific !== undefined || nextKycStatus === "submitted"
            ? new Date()
            : undefined,
        kycRejectionReason:
          nextKycStatus === "submitted" ? null : undefined,
        registrationSubmittedAt:
          documents !== undefined || roleSpecific !== undefined ? new Date() : undefined,
      },
      select: selectUser,
    });

    if (documents !== undefined) {
      await upsertRegistrationDocuments(req.user.id, documents);
    }

    return res.json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update current user error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ message: "Phone number or username already exists" });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateCurrentUserRole = async (req: Request, res: Response) => {
  try {
    const role =
      typeof req.body.role === "string"
        ? req.body.role.trim().toLowerCase()
        : undefined;

    if (!role || !allowedSelfRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { role },
      select: selectUser,
    });

    return res.json({
      message: "Role updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update current user role error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getEngineers = async (_req: Request, res: Response) => {
  try {
    const engineers = await prisma.user.findMany({
      where: {
        role: "engineer",
        banned: false,
      },
      select: {
        ...selectUser,
        kycDocuments: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json(engineers);
  } catch (error) {
    console.error("Get engineers error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUsersByRole = async (role: string, res: Response) => {
  const users = await prisma.user.findMany({
    where: {
      role,
      banned: false,
    },
    select: {
      ...selectUser,
      kycDocuments: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.json(users);
};

export const getSupervisors = async (_req: Request, res: Response) => {
  try {
    return await getUsersByRole("supervisor", res);
  } catch (error) {
    console.error("Get supervisors error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getSuppliers = async (_req: Request, res: Response) => {
  try {
    return await getUsersByRole("supplier", res);
  } catch (error) {
    console.error("Get suppliers error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      id,
      name,
      email,
      emailVerified,
      image,
      role,
      username,
      displayUsername,
      phoneNumber,
      phoneNumberVerified,
      fcmToken,
      notificationPrefs,
      roleSpecific,
      registrationDocuments,
      selfieUrl,
      password,
    } = req.body;

    if (!id || !name || !email) {
      return res.status(400).json({ message: "id, name and email are required" });
    }

    const user = await prisma.user.create({
      data: {
        id,
        name,
        email,
        emailVerified: Boolean(emailVerified),
        image,
        role: role || "client",
        username,
        displayUsername,
        phoneNumber,
        phoneNumberVerified:
          phoneNumberVerified !== undefined
            ? Boolean(phoneNumberVerified)
            : undefined,
        fcmToken,
        passwordHash: password ? await hashPassword(String(password)) : undefined,
        notificationPrefs: parseJson(notificationPrefs) || {},
        roleSpecific: parseJson(roleSpecific) || {},
        registrationDocuments: parseJson(registrationDocuments) || [],
        selfieUrl,
      },
      select: selectUser,
    });

    return res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const kycStatus =
      typeof req.query.kycStatus === "string" ? req.query.kycStatus : undefined;

    if (kycStatus !== undefined && !isKycStatus(kycStatus)) {
      return res.status(400).json({ message: "Invalid KYC status" });
    }

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(kycStatus ? { kycStatus } : {}),
      },
      select: selectUser,
      orderBy: { createdAt: "desc" },
    });

    return res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...selectUser,
        apiKeys: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Get user by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const {
      name,
      email,
      emailVerified,
      image,
      role,
      banned,
      banReason,
      banExpires,
      username,
      displayUsername,
      phoneNumber,
      phoneNumberVerified,
      fcmToken,
      kycStatus,
      kycRejectionReason,
      notificationPrefs,
      roleSpecific,
      registrationDocuments,
      selfieUrl,
      registrationSubmittedAt,
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (kycStatus !== undefined && !isKycStatus(kycStatus)) {
      return res.status(400).json({ message: "Invalid KYC status" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        emailVerified:
          emailVerified !== undefined ? Boolean(emailVerified) : undefined,
        image,
        role,
        banned: banned !== undefined ? Boolean(banned) : undefined,
        banReason,
        banExpires:
          banExpires !== undefined
            ? banExpires
              ? new Date(banExpires)
              : null
            : undefined,
        username,
        displayUsername,
        phoneNumber,
        phoneNumberVerified:
          phoneNumberVerified !== undefined
            ? Boolean(phoneNumberVerified)
            : undefined,
        fcmToken,
        kycStatus,
        kycRejectionReason,
        notificationPrefs:
          notificationPrefs !== undefined
            ? parseJson(notificationPrefs) || {}
            : undefined,
        roleSpecific:
          roleSpecific !== undefined ? parseJson(roleSpecific) || {} : undefined,
        registrationDocuments:
          registrationDocuments !== undefined
            ? parseJson(registrationDocuments) || []
            : undefined,
        selfieUrl,
        registrationSubmittedAt:
          registrationSubmittedAt !== undefined
            ? registrationSubmittedAt
              ? new Date(registrationSubmittedAt)
              : null
            : undefined,
      },
      select: selectUser,
    });

    return res.json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    await prisma.user.delete({ where: { id } });

    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

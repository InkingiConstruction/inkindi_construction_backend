import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../../../config/db.js";
import { createMobileJwt } from "../../../utils/mobile-jwt.js";
import { hashOtp, hashPassword, verifyPassword } from "../../../utils/password.js";
import { sendEmail } from "../../../integrations/resend.js";
import {
  emailVerificationTemplate,
  passwordResetTemplate,
} from "../../../utils/email-tempelates.js";

const allowedRoles = ["client", "engineer", "supervisor", "supplier", "admin"];

const selectUser = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  role: true,
  banned: true,
  username: true,
  displayUsername: true,
  phoneNumber: true,
  phoneNumberVerified: true,
  kycStatus: true,
  kycRejectionReason: true,
  roleSpecific: true,
  registrationDocuments: true,
  selfieUrl: true,
  registrationSubmittedAt: true,
  createdAt: true,
  updatedAt: true,
};

const sanitizeRole = (role: unknown) => {
  const nextRole = typeof role === "string" ? role.trim().toLowerCase() : "client";
  return allowedRoles.includes(nextRole) ? nextRole : null;
};

const createToken = (user: { id: string; role?: string | null }) =>
  createMobileJwt({ sub: user.id, role: user.role });

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const errorContains = (error: unknown, needle: string): boolean => {
  if (!error) {
    return false;
  }

  if (typeof error === "string") {
    return error.toLowerCase().includes(needle.toLowerCase());
  }

  if (typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;

  return Object.values(record).some((value) => errorContains(value, needle));
};

const getRegistrationConflictMessage = (error: unknown) => {
  const record = error as { code?: unknown; meta?: { target?: unknown } };
  const isUniqueConflict =
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002") ||
    record?.code === "P2002" ||
    errorContains(error, "23505");

  if (!isUniqueConflict) {
    return null;
  }

  const target = Array.isArray(record.meta?.target)
    ? record.meta.target.map(String)
    : [];

  if (target.includes("email") || errorContains(error, "email")) {
    return "Email is already registered";
  }

  if (target.includes("phoneNumber") || errorContains(error, "phoneNumber")) {
    return "Phone number is already registered";
  }

  if (target.includes("username") || errorContains(error, "username")) {
    return "Email username is already registered. Use another email address.";
  }

  return "This account already exists";
};

const sendVerificationOtp = async (user: { id: string; email: string }) => {
  const otp = generateOtp();

  await prisma.authOtp.create({
    data: {
      userId: user.id,
      email: user.email,
      codeHash: hashOtp(otp),
      type: "email-verification",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  const template = emailVerificationTemplate(otp);
  const sent = await sendEmail({ to: user.email, ...template });

  if (!sent && process.env.NODE_ENV !== "production") {
    console.log(`Email verification OTP for ${user.email}: ${otp}`);
  }
};

const sendPasswordResetOtp = async (user: { id: string; email: string }) => {
  const otp = generateOtp();

  await prisma.authOtp.create({
    data: {
      userId: user.id,
      email: user.email,
      codeHash: hashOtp(otp),
      type: "password-reset",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  const template = passwordResetTemplate(otp);
  const sent = await sendEmail({ to: user.email, ...template });

  if (!sent && process.env.NODE_ENV !== "production") {
    console.log(`Password reset OTP for ${user.email}: ${otp}`);
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = sanitizeRole(req.body.role);
    const phoneNumber = req.body.phoneNumber ? String(req.body.phoneNumber).trim() : undefined;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (!role) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    if (phoneNumber) {
      const existingPhone = await prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (existingPhone) {
        return res.status(409).json({ message: "Phone number is already registered" });
      }
    }

    const username = email.includes("@") ? email.split("@")[0] : email;

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return res
        .status(409)
        .json({ message: "Email username is already registered. Use another email address." });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        passwordHash,
        role,
        phoneNumber,
        phoneNumberVerified: Boolean(phoneNumber),
        username,
        displayUsername: username,
      },
      select: selectUser,
    });

    await sendVerificationOtp(user).catch((error) => {
      console.error("Send registration OTP error:", error);
    });

    return res.status(201).json({
      message: "Registered successfully",
      token: createToken(user),
      user,
    });
  } catch (error) {
    console.error("Register error:", error);
    const conflictMessage = getRegistrationConflictMessage(error);

    if (conflictMessage) {
      return res.status(409).json({ message: conflictMessage });
    }

    return res.status(500).json({ message: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...selectUser,
        passwordHash: true,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const validPassword = await verifyPassword(password, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.banned) {
      return res.status(403).json({ message: "Account is suspended" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash, ...safeUser } = user;

    return res.json({
      message: "Logged in successfully",
      token: createToken(safeUser),
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const verification = await prisma.authOtp.findFirst({
      where: {
        email,
        type: "email-verification",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verification || verification.codeHash !== hashOtp(otp)) {
      if (verification) {
        await prisma.authOtp.update({
          where: { id: verification.id },
          data: { attempts: { increment: 1 } },
        });
      }

      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        phoneNumberVerified: true,
      },
      select: selectUser,
    });

    await prisma.authOtp.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    return res.json({
      message: "Email verified successfully",
      user,
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ message: "Email verification failed" });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user) {
      await sendVerificationOtp(user);
    }

    return res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user) {
      await sendPasswordResetOtp(user);
    }

    return res.json({ message: "Password reset OTP sent successfully" });
  } catch (error) {
    console.error("Request password reset error:", error);
    return res.status(500).json({ message: "Failed to send password reset OTP" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const password = String(req.body.password || req.body.newPassword || "");

    if (!email || !otp || !password) {
      return res.status(400).json({ message: "Email, OTP and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const verification = await prisma.authOtp.findFirst({
      where: {
        email,
        type: "password-reset",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verification || verification.codeHash !== hashOtp(otp)) {
      if (verification) {
        await prisma.authOtp.update({
          where: { id: verification.id },
          data: { attempts: { increment: 1 } },
        });
      }

      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await prisma.user.update({
      where: { email },
      data: { passwordHash: await hashPassword(password) },
    });

    await prisma.authOtp.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password" });
  }
};

export const getMe = async (req: Request, res: Response) => {
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
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      return res.status(400).json({ message: "Password is not set for this account" });
    }

    const validPassword = await verifyPassword(currentPassword, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Failed to change password" });
  }
};

export const logout = async (_req: Request, res: Response) => {
  return res.json({ message: "Logged out successfully" });
};

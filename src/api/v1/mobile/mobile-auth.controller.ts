import { Request, Response } from "express";
import { auth } from "../../../config/auth.js";
import prisma from "../../../config/db.js";
import { createMobileJwt } from "../../../utils/mobile-jwt.js";

const allowedRoles = ["client", "engineer", "supervisor", "supplier"];

const authHeaders = () =>
  new Headers({
    origin: "inkindiapp://",
    "expo-origin": "inkindiapp://",
    "x-skip-oauth-proxy": "true",
  });

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
  createdAt: true,
  updatedAt: true,
};

const getMobileUser = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: selectUser,
  });

export const registerMobileUser = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const phoneNumber = req.body.phoneNumber
      ? String(req.body.phoneNumber).trim()
      : undefined;
    const role = String(req.body.role || "client").trim().toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const result = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        rememberMe: true,
      },
      headers: authHeaders(),
    });

    const username = email.includes("@") ? email.split("@")[0] : email;
    const user = await prisma.user.update({
      where: { id: result.user.id },
      data: {
        role,
        phoneNumber,
        phoneNumberVerified: Boolean(phoneNumber),
        username,
        displayUsername: username,
      },
      select: selectUser,
    });

    return res.status(201).json({
      message: "Registered successfully",
      token: createMobileJwt({ sub: user.id, role: user.role }),
      user,
    });
  } catch (error: any) {
    console.error("Mobile register error:", error);
    return res.status(error?.statusCode || 500).json({
      message: error?.body?.message || error?.message || "Registration failed",
    });
  }
};

export const loginMobileUser = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const result = await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: true,
      },
      headers: authHeaders(),
    });

    const user = await getMobileUser(result.user.id);

    return res.json({
      message: "Logged in successfully",
      token: user ? createMobileJwt({ sub: user.id, role: user.role }) : null,
      user,
    });
  } catch (error: any) {
    console.error("Mobile login error:", error);
    return res.status(error?.statusCode || 401).json({
      message: error?.body?.message || error?.message || "Invalid email or password",
    });
  }
};

export const verifyMobileEmail = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    await auth.api.verifyEmailOTP({
      body: { email, otp },
      headers: authHeaders(),
    });

    const user = await prisma.user.findUnique({
      where: { email },
      select: selectUser,
    });

    return res.json({
      message: "Email verified successfully",
      user,
    });
  } catch (error: any) {
    console.error("Mobile verify email error:", error);
    return res.status(error?.statusCode || 400).json({
      message: error?.body?.message || error?.message || "Email verification failed",
    });
  }
};

export const getMobileMe = async (req: Request, res: Response) => {
  try {
    const user = await getMobileUser(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Mobile me error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

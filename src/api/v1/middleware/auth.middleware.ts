import { NextFunction, Request, Response } from "express";
import { authenticatedUserRateLimit } from "./auth-security.middleware";
import prisma from "../../../config/db.js";
import { verifyMobileJwt } from "../../../utils/mobile-jwt.js";

export const requiredAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bearerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length).trim()
      : undefined;

    if (!bearerToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = verifyMobileJwt(bearerToken);

    if (!payload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.banned) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    req.role = user.role;
    return authenticatedUserRateLimit(req, res, next);
  } catch (error) {
    next(error);
  }
};

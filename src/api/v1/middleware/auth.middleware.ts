import { NextFunction, Request, Response } from "express";
import { auth } from "../../../config/auth";
import { fromNodeHeaders } from "better-auth/node";
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

    if (bearerToken) {
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

      req.user = user as typeof req.user;
      req.role = user.role;
      return authenticatedUserRateLimit(req, res, next);
    }

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.session = session;
    req.user = session.user;
    req.role = session.user.role;

    authenticatedUserRateLimit(req, res, next);
  } catch (error) {
    next(error);
  }
};

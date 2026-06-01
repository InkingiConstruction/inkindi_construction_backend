import { NextFunction, Request, Response } from "express";
import { auth } from "../../../config/auth";
import { fromNodeHeaders } from "better-auth/node";
import { authenticatedUserRateLimit } from "./auth-security.middleware";

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
      const session = await auth.api.getSession({
        headers: new Headers({
          authorization: `Bearer ${bearerToken}`,
        }),
      });

      if (session) {
        req.session = session;
        req.user = session.user;
        req.role = session.user.role;
        return authenticatedUserRateLimit(req, res, next);
      }
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

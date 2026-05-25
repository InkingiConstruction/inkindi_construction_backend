import { NextFunction, Request, Response } from "express";

export const requireRole =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden",
        requiredRoles: roles,
        currentRole: req.user.role,
      });
    }
    next();
  };

export const isAdmin = requireRole("admin");
export const isClient = requireRole("client");
export const isEngineer = requireRole("engineer");
export const isSupervisor = requireRole("supervisor");
export const isSupplier = requireRole("supplier");

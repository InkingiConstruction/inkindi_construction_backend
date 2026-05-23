export const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
    }
    next();
};
export const isAdmin = requireRole("admin");
export const isClient = requireRole("client");
export const isEngineer = requireRole("engineer");
export const isSupervisor = requireRole("supervisor");
export const isSupplier = requireRole("supplier");

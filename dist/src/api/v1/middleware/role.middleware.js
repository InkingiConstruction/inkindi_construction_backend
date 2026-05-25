"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupplier = exports.isSupervisor = exports.isEngineer = exports.isClient = exports.isAdmin = exports.requireRole = void 0;
const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            message: "Forbidden",
            requiredRoles: roles,
            currentRole: req.user.role,
        });
    }
    next();
};
exports.requireRole = requireRole;
exports.isAdmin = (0, exports.requireRole)("admin");
exports.isClient = (0, exports.requireRole)("client");
exports.isEngineer = (0, exports.requireRole)("engineer");
exports.isSupervisor = (0, exports.requireRole)("supervisor");
exports.isSupplier = (0, exports.requireRole)("supplier");

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredAuth = void 0;
const auth_1 = require("../../../config/auth");
const node_1 = require("better-auth/node");
const auth_security_middleware_1 = require("./auth-security.middleware");
const requiredAuth = async (req, res, next) => {
    try {
        const session = await auth_1.auth.api.getSession({
            headers: (0, node_1.fromNodeHeaders)(req.headers),
        });
        if (!session) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        req.session = session;
        req.user = session.user;
        req.role = session.user.role;
        (0, auth_security_middleware_1.authenticatedUserRateLimit)(req, res, next);
    }
    catch (error) {
        next(error);
    }
};
exports.requiredAuth = requiredAuth;

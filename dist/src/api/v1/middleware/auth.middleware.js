"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredAuth = void 0;
const auth_1 = require("../../../config/auth");
const node_1 = require("better-auth/node");
const auth_security_middleware_1 = require("./auth-security.middleware");
const db_js_1 = __importDefault(require("../../../config/db.js"));
const mobile_jwt_js_1 = require("../../../utils/mobile-jwt.js");
const requiredAuth = async (req, res, next) => {
    try {
        const bearerToken = req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice("Bearer ".length).trim()
            : undefined;
        if (bearerToken) {
            const payload = (0, mobile_jwt_js_1.verifyMobileJwt)(bearerToken);
            if (!payload) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const user = await db_js_1.default.user.findUnique({
                where: { id: payload.sub },
            });
            if (!user || user.banned) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            req.user = user;
            req.role = user.role;
            return (0, auth_security_middleware_1.authenticatedUserRateLimit)(req, res, next);
        }
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

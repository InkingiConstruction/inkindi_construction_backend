"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredAuth = void 0;
const auth_security_middleware_1 = require("./auth-security.middleware");
const db_js_1 = __importDefault(require("../../../config/db.js"));
const mobile_jwt_js_1 = require("../../../utils/mobile-jwt.js");
const requiredAuth = async (req, res, next) => {
    try {
        const bearerToken = req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice("Bearer ".length).trim()
            : undefined;
        if (!bearerToken) {
            return res.status(401).json({ message: "Unauthorized" });
        }
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
    catch (error) {
        next(error);
    }
};
exports.requiredAuth = requiredAuth;

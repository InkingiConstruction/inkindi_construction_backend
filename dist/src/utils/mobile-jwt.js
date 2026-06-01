"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMobileJwt = exports.createMobileJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const getSecret = () => {
    const secret = process.env.JWT_SECRET || process.env.MOBILE_JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET or MOBILE_JWT_SECRET is required");
    }
    return secret;
};
const createMobileJwt = (payload) => jsonwebtoken_1.default.sign({
    sub: payload.sub,
    role: payload.role,
}, getSecret(), {
    algorithm: "HS256",
    expiresIn: "30d",
});
exports.createMobileJwt = createMobileJwt;
const verifyMobileJwt = (token) => {
    try {
        const payload = jsonwebtoken_1.default.verify(token, getSecret(), {
            algorithms: ["HS256"],
        });
        if (!payload.sub || typeof payload.sub !== "string" || !payload.exp) {
            return null;
        }
        return {
            sub: payload.sub,
            role: typeof payload.role === "string" ? payload.role : null,
            exp: payload.exp,
        };
    }
    catch {
        return null;
    }
};
exports.verifyMobileJwt = verifyMobileJwt;

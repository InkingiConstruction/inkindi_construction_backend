"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMobileJwt = exports.createMobileJwt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const getSecret = () => {
    const secret = process.env.MOBILE_JWT_SECRET || process.env.BETTER_AUTH_SECRET;
    if (!secret) {
        throw new Error("MOBILE_JWT_SECRET or BETTER_AUTH_SECRET is required");
    }
    return secret;
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const sign = (value) => crypto_1.default.createHmac("sha256", getSecret()).update(value).digest("base64url");
const safeEqual = (left, right) => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (leftBuffer.length === rightBuffer.length &&
        crypto_1.default.timingSafeEqual(leftBuffer, rightBuffer));
};
const createMobileJwt = (payload) => {
    const header = encode({ alg: "HS256", typ: "JWT" });
    const body = encode({
        sub: payload.sub,
        role: payload.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    });
    const unsignedToken = `${header}.${body}`;
    return `${unsignedToken}.${sign(unsignedToken)}`;
};
exports.createMobileJwt = createMobileJwt;
const verifyMobileJwt = (token) => {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) {
        return null;
    }
    const expectedSignature = sign(`${header}.${body}`);
    if (!safeEqual(signature, expectedSignature)) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    }
    catch {
        return null;
    }
};
exports.verifyMobileJwt = verifyMobileJwt;

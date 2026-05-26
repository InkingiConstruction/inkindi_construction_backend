"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_1 = require("better-auth/node");
const auth_1 = require("./lib/auth");
const v1_1 = __importDefault(require("./api/v1"));
const auth_security_middleware_1 = require("./api/v1/middleware/auth-security.middleware");
const app = (0, express_1.default)();
const port = process.env.PORT;
const isProduction = process.env.NODE_ENV === "production";
const envAllowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    "http://192.168.1.171:8081",
    "https://inkindi-construction-backend.onrender.com",
    process.env.FRONTEND_URL,
    process.env.MOBILE_URL,
    ...envAllowedOrigins,
].filter(Boolean);
const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;
function isAllowedOrigin(origin) {
    return (allowedOrigins.includes(origin) ||
        (!isProduction && devOriginPattern.test(origin)));
}
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        }
        else {
            console.log(`Blocked origin: ${origin}`);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
}));
app.use("/api/v1/auth", (req, _res, next) => {
    if (!isProduction && !req.headers.origin) {
        req.headers.origin = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    }
    next();
});
app.post("/api/v1/auth/sign-in/email", express_1.default.json(), auth_security_middleware_1.emailSignInLockout);
app.all("/api/v1/auth/*splat", (0, node_1.toNodeHandler)(auth_1.auth));
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.send("Inkingi API is Live! 🚀");
});
app.use("/api/v1", v1_1.default);
app.listen(Number(port), "0.0.0.0", () => {
    console.log("Server is running at http://0.0.0.0:" + port);
});

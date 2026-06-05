"use strict";
/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : app.ts
 * WHAT THIS FILE DOES : Main application server configuration and global middleware registry
 * HOW IT DOES IT      : Instantiates Express, configures Gzip compression, request logs, CORS, and API routing
 * DATA SOURCE         : Client HTTP Requests
 * DATA DESTINATION    : HTTP Response streams
 * PRINCIPLE APPLIED   : SOLID (Centralized bootstrapping layer)
 * ============================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const v1_1 = __importDefault(require("./api/v1"));
const logger_middleware_1 = require("./common/middleware/logger.middleware");
const wallet_queue_1 = require("./queues/wallet.queue");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
/**
 * 🧱 CODE BLOCK: CORS Origins Configuration
 * WHAT IT IS DOING: Determines permitted client URLs from dynamic environment lists
 * WHY IT IS HERE  : Secures API against unsolicited cross-origin calls in production
 * PRINCIPLE       : KISS
 * DATA SOURCE     : env variables (CORS_ORIGINS, FRONTEND_URL, MOBILE_URL)
 * DATA DESTINATION: cors configuration callback
 */
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
    process.env.BACKEND_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.FRONTEND_URL,
    process.env.MOBILE_URL,
    ...envAllowedOrigins,
].filter(Boolean);
const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;
const mobileOriginPattern = /^(inkindiapp|exp):\/\/.*/;
/**
 * ============================================================================
 * 🔧 FUNCTION: isAllowedOrigin
 * ============================================================================
 * WHAT IT DOES: Assesses if an incoming request origin is registered or in safe subnet limits
 * PARAMETERS:
 *   - origin (string) : Client host header origin
 * RETURNS: boolean - True if authorized
 * WHO CALLS IT: CORS setup callback
 * PRINCIPLE: KISS
 * ============================================================================
 */
function isAllowedOrigin(origin) {
    return (allowedOrigins.includes(origin) ||
        mobileOriginPattern.test(origin) ||
        (!isProduction && devOriginPattern.test(origin)));
}
// 1. Global Request Logger Middleware
app.use(logger_middleware_1.requestLoggerMiddleware);
// 2. Global Gzip compression
app.use((0, compression_1.default)());
// 3. CORS Policies Setup
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        }
        else {
            logger_middleware_1.logger.warn(`Blocked origin attempt: ${origin}`);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
}));
app.use(express_1.default.json());
// 5. Root Entry Diagnostics
app.get("/", (_req, res) => {
    res.send("Inkingi API is Live! 🚀");
});
// 6. Unified Api version v1 endpoint routing
app.use("/api/v1", v1_1.default);
// Boot up Listener
app.listen(Number(port), "0.0.0.0", () => {
    logger_middleware_1.logger.info(`Server successfully bootstrapped at http://0.0.0.0:${port}`);
    logger_middleware_1.logger.info(`Swagger REST API Documentation active at http://localhost:${port}/api/v1/docs`);
    (0, wallet_queue_1.startWalletWorker)();
});
exports.default = app;

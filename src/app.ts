/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : app.ts
 * WHAT THIS FILE DOES : Main application server configuration and global middleware registry
 * HOW IT DOES IT      : Instantiates Express, configures Gzip compression, request logs, CORS, Better Auth, and API routing
 * DATA SOURCE         : Client HTTP Requests
 * DATA DESTINATION    : HTTP Response streams
 * PRINCIPLE APPLIED   : SOLID (Centralized bootstrapping layer)
 * ============================================================================
 */

import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import compression from "compression";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth";
import v1Routes from "./api/v1";
import { requestLoggerMiddleware, logger } from "./common/middleware/logger.middleware";

const app = express();
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
  process.env.FRONTEND_URL,
  process.env.MOBILE_URL,
  ...envAllowedOrigins,
].filter(Boolean) as string[];

const devOriginPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;

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
function isAllowedOrigin(origin: string): boolean {
  return (
    allowedOrigins.includes(origin) ||
    (!isProduction && devOriginPattern.test(origin))
  );
}

// 1. Global Request Logger Middleware
app.use(requestLoggerMiddleware);

// 2. Global Gzip compression
app.use(compression());

// 3. CORS Policies Setup
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Blocked origin attempt: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  }),
);

app.all("/api/v1/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// 5. Root Entry Diagnostics
app.get("/", (_req: Request, res: Response) => {
  res.send("Inkingi API is Live! 🚀");
});

// 6. Unified Api version v1 endpoint routing
app.use("/api/v1", v1Routes);

// Boot up Listener
app.listen(Number(port), "0.0.0.0", () => {
  logger.info(`Server successfully bootstrapped at http://0.0.0.0:${port}`);
  logger.info(`Swagger REST API Documentation active at http://localhost:${port}/api/v1/docs`);
});

export default app;

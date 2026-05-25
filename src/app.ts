import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import v1Routes from "./api/v1";

const app = express();
const port = process.env.PORT;
const isProduction = process.env.NODE_ENV === "production";
const envAllowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8081",
  "http://192.168.1.171:8081",
  process.env.FRONTEND_URL,
  process.env.MOBILE_URL,
  ...envAllowedOrigins,
].filter(Boolean) as string[];

const devOriginPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;

function isAllowedOrigin(origin: string) {
  return (
    allowedOrigins.includes(origin) ||
    (!isProduction && devOriginPattern.test(origin))
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.log(`Blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  }),
);

app.use("/api/v1/auth", (req, _res, next) => {
  if (!isProduction && !req.headers.origin) {
    req.headers.origin = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  }

  next();
});

app.all("/api/v1/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.send("Inkingi API is Live! 🚀");
});

app.use("/api/v1", v1Routes);

app.listen(Number(port), "0.0.0.0", () => {
  console.log("Server is running at http://0.0.0.0:" + port);
});

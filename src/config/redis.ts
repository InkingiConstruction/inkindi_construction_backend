/**
 * ============================================================================
 * 📄 FILE: redis.ts
 * PURPOSE: Single Redis connection reused by the app, BullMQ, and any other
 *          client that needs Redis. Exposes the raw client + a BullMQ-
 *          compatible connection option.
 * ============================================================================
 */

import { Redis } from "ioredis";
import { logger } from "../common/middleware/logger.middleware";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

/**
 * Raw ioredis client. Use this for direct Redis commands (e.g. caching).
 */
export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: false,
});

redisClient.on("connect", () => {
  logger.info(" Connected to Redis successfully");
});

redisClient.on("error", (error: Error) => {
  logger.error(` Redis connection error: ${error.message}`);
});

/**
 * Same client, exposed under the name BullMQ files import by default.
 */
export const redisConnection = redisClient;

export default redisClient;

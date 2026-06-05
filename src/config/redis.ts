/**
 * ============================================================================
 * 📄 FILE: redis.ts
 * PURPOSE: Single Redis connection reused by the app, BullMQ, and any other
 *          client that needs Redis. Exposes the raw client + a BullMQ-
 *          compatible connection option.
 * ============================================================================
 */

import { Redis, type RedisOptions } from "ioredis";
import { logger } from "../common/middleware/logger.middleware";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisUsesTls = redisUrl.startsWith("rediss://") || process.env.REDIS_TLS === "true";

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: false,
  connectTimeout: 10000,
  keepAlive: 10000,
  lazyConnect: false,
  tls: redisUsesTls ? {} : undefined,
  retryStrategy: (times) => Math.min(500 + times * 250, 5000),
  reconnectOnError: (error) => {
    if (error.message.includes("ECONNRESET")) return 1;
    return false;
  },
};

/**
 * Raw ioredis client. Use this for direct Redis commands (e.g. caching).
 */
export const redisClient = new Redis(redisUrl, redisOptions);

let hasLoggedReady = false;

redisClient.on("ready", () => {
  if (!hasLoggedReady) {
    logger.info("Connected to Redis successfully");
    hasLoggedReady = true;
  }
});

redisClient.on("error", (error: Error) => {
  logger.warn(`Redis connection issue: ${error.message}`);
});

redisClient.on("reconnecting", (delay: number) => {
  logger.warn(`Redis reconnecting in ${delay}ms`);
});

/**
 * Same client, exposed under the name BullMQ files import by default.
 */
export const redisConnection = redisClient;

export default redisClient;

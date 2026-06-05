"use strict";
/**
 * ============================================================================
 * 📄 FILE: redis.ts
 * PURPOSE: Single Redis connection reused by the app, BullMQ, and any other
 *          client that needs Redis. Exposes the raw client + a BullMQ-
 *          compatible connection option.
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = exports.redisClient = exports.redisOptions = void 0;
const ioredis_1 = require("ioredis");
const logger_middleware_1 = require("../common/middleware/logger.middleware");
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisUsesTls = redisUrl.startsWith("rediss://") ||
    redisUrl.includes(".upstash.io") ||
    process.env.REDIS_TLS === "true";
exports.redisOptions = {
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: false,
    connectTimeout: 10000,
    keepAlive: 10000,
    lazyConnect: false,
    tls: redisUsesTls ? {} : undefined,
    retryStrategy: (times) => Math.min(500 + times * 250, 5000),
    reconnectOnError: (error) => {
        if (error.message.includes("ECONNRESET"))
            return 1;
        return false;
    },
};
/**
 * Raw ioredis client. Use this for direct Redis commands (e.g. caching).
 */
exports.redisClient = new ioredis_1.Redis(redisUrl, exports.redisOptions);
let hasLoggedReady = false;
exports.redisClient.on("ready", () => {
    if (!hasLoggedReady) {
        logger_middleware_1.logger.info("Connected to Redis successfully");
        hasLoggedReady = true;
    }
});
exports.redisClient.on("error", (error) => {
    logger_middleware_1.logger.warn(`Redis connection issue: ${error.message}`);
});
exports.redisClient.on("reconnecting", (delay) => {
    logger_middleware_1.logger.warn(`Redis reconnecting in ${delay}ms`);
});
/**
 * Same client, exposed under the name BullMQ files import by default.
 */
exports.redisConnection = exports.redisClient;
exports.default = exports.redisClient;

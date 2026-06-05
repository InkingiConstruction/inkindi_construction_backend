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
exports.redisConnection = exports.redisClient = void 0;
const ioredis_1 = require("ioredis");
const logger_middleware_1 = require("../common/middleware/logger.middleware");
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
/**
 * Raw ioredis client. Use this for direct Redis commands (e.g. caching).
 */
exports.redisClient = new ioredis_1.Redis(redisUrl, {
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: false,
});
exports.redisClient.on("connect", () => {
    logger_middleware_1.logger.info(" Connected to Redis successfully");
});
exports.redisClient.on("error", (error) => {
    logger_middleware_1.logger.error(` Redis connection error: ${error.message}`);
});
/**
 * Same client, exposed under the name BullMQ files import by default.
 */
exports.redisConnection = exports.redisClient;
exports.default = exports.redisClient;

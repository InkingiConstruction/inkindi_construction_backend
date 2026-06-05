"use strict";
/**
 * ============================================================================
 * 📄 FILE: wallet.queue.ts
 * PURPOSE: BullMQ queue for wallet-related async events
 *          (created, funded, vault transfer, milestone payout, freeze/unfreeze)
 * ============================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWalletWorker = exports.walletQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_js_1 = __importDefault(require("../config/redis.js"));
const logger_middleware_js_1 = require("../common/middleware/logger.middleware.js");
/**
 * BullMQ's Queue/Worker type expects its own bundled ConnectionOptions.
 * We cast our ioredis client to that — they're runtime-compatible.
 */
const connection = redis_js_1.default;
exports.walletQueue = new bullmq_1.Queue("wallet-events", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
    },
});
/**
 * Worker: processes wallet events asynchronously.
 * Use job.name to dispatch on event type; job.data is the payload.
 */
const startWalletWorker = () => {
    const worker = new bullmq_1.Worker("wallet-events", async (job) => {
        const event = job.data;
        const eventName = job.name;
        logger_middleware_js_1.logger.info(`[wallet-queue] Processing ${eventName} (job ${job.id})`);
        switch (eventName) {
            case "wallet.created":
                logger_middleware_js_1.logger.info(`Wallet created for user ${event.userId}: ${event.walletId}`);
                break;
            case "wallet.funded":
                logger_middleware_js_1.logger.info(`Wallet ${event.walletId} funded with ${event.amount}`);
                break;
            case "wallet.vault_transfer":
                logger_middleware_js_1.logger.info(`Transferred ${event.amount} from wallet ${event.walletId} to vault ${event.escrowAccountId}`);
                break;
            case "wallet.milestone_payout":
                logger_middleware_js_1.logger.info(`Milestone payout: ${event.amount} to user ${event.recipientId}`);
                break;
            case "wallet.frozen":
                logger_middleware_js_1.logger.warn(`Wallet ${event.walletId} frozen: ${event.reason}`);
                break;
            case "wallet.unfrozen":
                logger_middleware_js_1.logger.info(`Wallet ${event.walletId} unfrozen`);
                break;
            default:
                logger_middleware_js_1.logger.warn(`[wallet-queue] Unknown event: ${eventName}`);
        }
    }, { connection, concurrency: 5 });
    worker.on("failed", (job, err) => {
        logger_middleware_js_1.logger.error(`[wallet-queue] Job ${job?.id} failed:`, err);
    });
    worker.on("completed", (job) => {
        logger_middleware_js_1.logger.info(`[wallet-queue] Job ${job.id} completed`);
    });
    return worker;
};
exports.startWalletWorker = startWalletWorker;

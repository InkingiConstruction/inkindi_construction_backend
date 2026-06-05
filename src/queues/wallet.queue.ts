/**
 * ============================================================================
 * 📄 FILE: wallet.queue.ts
 * PURPOSE: BullMQ queue for wallet-related async events
 *          (created, funded, vault transfer, milestone payout, freeze/unfreeze)
 * ============================================================================
 */

import { Queue, Worker, Job, type ConnectionOptions } from "bullmq";
import redisConnection from "../config/redis.js";
import { logger } from "../common/middleware/logger.middleware.js";

/**
 * BullMQ's Queue/Worker type expects its own bundled ConnectionOptions.
 * We cast our ioredis client to that — they're runtime-compatible.
 */
const connection = redisConnection as unknown as ConnectionOptions;

/**
 * Payload sent with each wallet event. The event type is the job NAME,
 * not a field inside the payload.
 */
export type WalletEventData = {
  userId?: string;
  walletId: string;
  amount?: number;
  fundingRequestId?: string;
  escrowAccountId?: string;
  milestoneId?: string;
  recipientId?: string;
  reason?: string;
};

export const walletQueue = new Queue<WalletEventData>("wallet-events", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
  },
});

walletQueue.on("error", (error) => {
  logger.warn(`[wallet-queue] Queue connection issue: ${error.message}`);
});

/**
 * Worker: processes wallet events asynchronously.
 * Use job.name to dispatch on event type; job.data is the payload.
 */
export const startWalletWorker = () => {
  const worker = new Worker<WalletEventData>(
    "wallet-events",
    async (job: Job<WalletEventData>) => {
      const event = job.data;
      const eventName = job.name;

      logger.info(`[wallet-queue] Processing ${eventName} (job ${job.id})`);

      switch (eventName) {
        case "wallet.created":
          logger.info(`Wallet created for user ${event.userId}: ${event.walletId}`);
          break;
        case "wallet.funded":
          logger.info(`Wallet ${event.walletId} funded with ${event.amount}`);
          break;
        case "wallet.vault_transfer":
          logger.info(
            `Transferred ${event.amount} from wallet ${event.walletId} to vault ${event.escrowAccountId}`,
          );
          break;
        case "wallet.milestone_payout":
          logger.info(`Milestone payout: ${event.amount} to user ${event.recipientId}`);
          break;
        case "wallet.frozen":
          logger.warn(`Wallet ${event.walletId} frozen: ${event.reason}`);
          break;
        case "wallet.unfrozen":
          logger.info(`Wallet ${event.walletId} unfrozen`);
          break;
        default:
          logger.warn(`[wallet-queue] Unknown event: ${eventName}`);
      }
    },
    { connection, concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    logger.error(`[wallet-queue] Job ${job?.id} failed:`, err);
  });

  worker.on("error", (error) => {
    logger.warn(`[wallet-queue] Worker connection issue: ${error.message}`);
  });

  worker.on("completed", (job) => {
    logger.info(`[wallet-queue] Job ${job.id} completed`);
  });

  return worker;
};

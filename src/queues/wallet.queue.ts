import { Queue, Worker, Job } from "bullmq";
import redisConnection from "../config/redis.js";
import { logger } from "../common/middleware/logger.middleware.js";

export type WalletEvent =
  | { type: "wallet.created"; userId: string; walletId: string }
  | { type: "wallet.funded"; userId: string; walletId: string; amount: number; fundingRequestId: string }
  | { type: "wallet.vault_transfer"; userId: string; walletId: string; escrowAccountId: string; amount: number }
  | { type: "wallet.milestone_payout"; walletId: string; milestoneId: string; amount: number; recipientId: string }
  | { type: "wallet.frozen"; walletId: string; reason: string }
  | { type: "wallet.unfrozen"; walletId: string };

export const walletQueue = new Queue<WalletEvent>("wallet-events", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
  },
});

/**
 * Worker: processes wallet events asynchronously
 * - Sends notifications
 * - Updates analytics
 * - Triggers webhooks
 */
export const startWalletWorker = () => {
  const worker = new Worker<WalletEvent>(
    "wallet-events",
    async (job: Job<WalletEvent>) => {
      const event = job.data;

      logger.info(`[wallet-queue] Processing event ${event.type} for job ${job.id}`);

      switch (event.type) {
        case "wallet.created":
          // TODO: send welcome notification, analytics, etc.
          logger.info(`Wallet created for user ${event.userId}: ${event.walletId}`);
          break;

        case "wallet.funded":
          logger.info(`Wallet ${event.walletId} funded with ${event.amount}`);
          // TODO: send receipt email, push notification
          break;

        case "wallet.vault_transfer":
          logger.info(`Transferred ${event.amount} from wallet ${event.walletId} to vault ${event.escrowAccountId}`);
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
      }
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    logger.error(`[wallet-queue] Job ${job?.id} failed:`, err);
  });

  worker.on("completed", (job) => {
    logger.info(`[wallet-queue] Job ${job.id} completed`);
  });

  return worker;
};

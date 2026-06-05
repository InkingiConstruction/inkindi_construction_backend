import { walletQueue } from "./queues/wallet.queue";
import { redisConnection } from "./config/redis";

async function purge() {
  const jobs = await walletQueue.getJobs(["wait", "active", "delayed", "failed"]);
  console.log(`Found ${jobs.length} jobs. Purging...`);
  await Promise.all(jobs.map((j) => j.remove()));
  await walletQueue.close();
  await redisConnection.quit();
  console.log("✅ Queue purged");
}

purge().catch((e) => {
  console.error(e);
  process.exit(1);
});

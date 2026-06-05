"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wallet_queue_1 = require("./queues/wallet.queue");
const redis_1 = require("./config/redis");
async function purge() {
    const jobs = await wallet_queue_1.walletQueue.getJobs(["wait", "active", "delayed", "failed"]);
    console.log(`Found ${jobs.length} jobs. Purging...`);
    await Promise.all(jobs.map((j) => j.remove()));
    await wallet_queue_1.walletQueue.close();
    await redis_1.redisConnection.quit();
    console.log("✅ Queue purged");
}
purge().catch((e) => {
    console.error(e);
    process.exit(1);
});

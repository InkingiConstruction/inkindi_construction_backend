import IORedis from "ioredis";

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redisConnection;

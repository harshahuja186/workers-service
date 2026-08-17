const { getRedisConnection } = require("./redis");

const TODO_QUEUE = process.env.BULLMQ_QUEUE || "todo";

const workerOptions = {
  connection: getRedisConnection(),
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  // If the process dies mid-job, BullMQ returns the lock to `wait` after this.
  lockDuration: 30_000,
  stalledInterval: 30_000,
  maxStalledCount: 1,
};

module.exports = { TODO_QUEUE, workerOptions };

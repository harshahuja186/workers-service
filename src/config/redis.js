const path = require("path");
const fs = require("fs");

/**
 * Connection options for BullMQ (ioredis).
 * maxRetriesPerRequest: null is required for Workers — they use blocking Redis commands.
 * Pass this object (not a shared ioredis instance) so BullMQ can open its own connections.
 */
const getRedisConnection = () => {
  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT);
  const username = process.env.REDIS_USERNAME || "default";
  const password = process.env.REDIS_PASSWORD;

  if (!host || !port || !password) {
    throw new Error(
      "Missing Redis config. Set REDIS_HOST, REDIS_PORT, REDIS_PASSWORD in .env",
    );
  }

  return {
    host,
    port,
    username,
    password,
    maxRetriesPerRequest: null,
  };
};

module.exports = { getRedisConnection };

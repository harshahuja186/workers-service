const Redis = require("ioredis");
const path = require("path");
const fs = require("fs");

// Load .env without requiring dotenv (keeps this service lightweight).
function loadEnv() {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();

let redisClient = null;

const connectRedis = async () => {
  if (redisClient) return redisClient;

  try {
    const host = process.env.REDIS_HOST;
    const port = Number(process.env.REDIS_PORT);
    const username = process.env.REDIS_USERNAME || "default";
    const password = process.env.REDIS_PASSWORD;

    if (!host || !port || !password) {
      throw new Error(
        "Missing Redis config. Set REDIS_HOST, REDIS_PORT, REDIS_PASSWORD in .env",
      );
    }

    console.log("🔌 Connecting to Redis (ioredis)...");

    redisClient = new Redis({
      host,
      port,
      username,
      password,
      maxRetriesPerRequest: null, // required for long-running workers / blocking reads
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on("error", (err) => console.error("❌ Redis Error:", err.message));
    redisClient.on("ready", () => console.log("✅ Redis Connected!"));
    redisClient.on("reconnecting", () => console.log("♻️  Redis reconnecting..."));

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error(`❌ Redis Connection Failed: ${error.message}`);
    redisClient = null;
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error("Redis client not initialized. Call connectRedis() first.");
  }
  return redisClient;
};

module.exports = { connectRedis, getRedisClient };

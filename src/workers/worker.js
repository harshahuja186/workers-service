const { connectRedis, getRedisClient } = require("../config/redis");

const STREAM = process.argv[2] || "todo:stream";
const GROUP = process.argv[3] || "email-worker";
const CONSUMER = `worker-${process.pid}`;

let handlers = {};
try {
  handlers = require("../handlers");
} catch {
  console.warn(
    "[worker] No handlers module found at src/handlers — messages will be acked without processing.",
  );
}

async function ensureGroupExists(client) {
  try {
    // ioredis: XGROUP CREATE key group id MKSTREAM
    await client.xgroup("CREATE", STREAM, GROUP, "0", "MKSTREAM");
  } catch (error) {
    if (!String(error.message).includes("BUSYGROUP")) {
      throw error;
    }
  }
}

function parseStreamMessages(res) {
  if (!res) return [];

  const parsed = [];
  for (const [streamName, messages] of res) {
    for (const [id, fields] of messages) {
      const message = {};
      for (let i = 0; i < fields.length; i += 2) {
        message[fields[i]] = fields[i + 1];
      }
      parsed.push({ streamName, id, message });
    }
  }
  return parsed;
}

/**
 * Resolve handler from nested project folders:
 *   handlers[project][event]
 *
 * project comes from (in order):
 *   1) message.project
 *   2) stream prefix  ("todo:events" → "todo")
 */
function resolveHandler(streamName, message) {
  const project =
    message.project || String(streamName || STREAM).split(":")[0] || null;
  const event = message.event;

  if (!project || !event) return null;

  const projectHandlers = handlers[project];
  if (!projectHandlers) return null;

  return typeof projectHandlers[event] === "function"
    ? projectHandlers[event]
    : null;
}

async function runWorker() {
  let client;

  try {
    await connectRedis();
    client = getRedisClient();
    await ensureGroupExists(client);

    console.log(`[${CONSUMER}] listening on stream=${STREAM} group=${GROUP}`);

    while (true) {
      // ioredis: XREADGROUP GROUP group consumer COUNT n BLOCK ms STREAMS key id
      const res = await client.xreadgroup(
        "GROUP",
        GROUP,
        CONSUMER,
        "COUNT",
        1,
        "BLOCK",
        5000,
        "STREAMS",
        STREAM,
        ">",
      );

      if (!res) continue;

      for (const { streamName, id, message } of parseStreamMessages(res)) {
        try {
          const handler = resolveHandler(streamName, message);
          if (!handler) {
            console.warn(
              `[${CONSUMER}] No handler for project=${message.project || streamName.split(":")[0]} event=${message.event} id=${id}`,
            );
          } else {
            await handler(message);
          }
          await client.xack(STREAM, GROUP, id);
        } catch (error) {
          console.error(
            `[${CONSUMER}] Error processing ${id}: ${error.message}`,
          );
          // Leave unacked for retry / pending reclaim. Do not invent delete APIs.
        }
      }
    }
  } catch (error) {
    console.error(`[${CONSUMER}] Error: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        await client.quit();
      } catch {
        // ignore quit errors on shutdown
      }
    }
  }
}

runWorker();

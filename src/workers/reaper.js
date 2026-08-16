// reaper.js — reclaim idle pending stream messages (ioredis)
const { connectRedis, getRedisClient } = require("../config/redis");

const STREAM = process.argv[2] || "todo:stream";
const GROUP = process.argv[3] || "email-workers";
const IDLE_MS = 30000;
const MAX_DELIVERIES = 5;
const REAPER_CONSUMER = "reaper";

function fieldsToObject(fields) {
  const message = {};
  if (!Array.isArray(fields)) return message;
  for (let i = 0; i < fields.length; i += 2) {
    message[fields[i]] = fields[i + 1];
  }
  return message;
}

function flattenForXAdd(obj) {
  const args = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    args.push(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return args;
}

async function run() {
  await connectRedis();
  const client = getRedisClient();
  console.log(`Reaper watching ${STREAM}/${GROUP}...`);

  while (true) {
    try {
      // ioredis: XAUTOCLAIM key group consumer min-idle-time start COUNT n
      // reply: [ nextId, [[id, [field, value, ...]], ...], [deletedIds?] ]
      const reply = await client.xautoclaim(
        STREAM,
        GROUP,
        REAPER_CONSUMER,
        IDLE_MS,
        "0-0",
        "COUNT",
        10,
      );

      const claimed = Array.isArray(reply?.[1]) ? reply[1] : [];

      for (const entry of claimed) {
        const id = entry[0];
        const message = fieldsToObject(entry[1]);

        // ioredis: XPENDING key group start end count
        // reply: [[id, consumer, idleMs, deliveries], ...]
        const pending = await client.xpending(STREAM, GROUP, id, id, 1);
        const deliveryCount = Number(pending?.[0]?.[3] || 1);

        if (deliveryCount > MAX_DELIVERIES) {
          await client.xadd(
            `${STREAM}:dlq`,
            "*",
            ...flattenForXAdd({
              originalId: id,
              ...message,
            }),
          );
          await client.xack(STREAM, GROUP, id);
          console.log(`DLQ'd ${id} (deliveries=${deliveryCount})`);
        } else {
          console.log(`Reclaimed ${id}, attempt ${deliveryCount}`);
          // Owned by 'reaper' until idle again past IDLE_MS.
        }
      }
    } catch (error) {
      console.error(`Reaper error: ${error.message}`);
    }

    await new Promise((r) => setTimeout(r, 10000));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

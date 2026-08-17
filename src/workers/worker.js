const { Worker, UnrecoverableError } = require("bullmq");
const { TODO_QUEUE, workerOptions } = require("../config/bullmq");

const WORKER_ID = `worker-${process.pid}`;

let handlers = {};
try {
  handlers = require("../handlers");
} catch {
  console.warn(
    `[${WORKER_ID}] No handlers module found at src/handlers — jobs without handlers will fail.`,
  );
}

/**
 * Route by queue name (project) + job name (event):
 *   handlers[job.queueName][job.name]
 * e.g. queue "todo", job "login" → handlers.todo.login
 */
function resolveHandler(job) {
  const projectHandlers = handlers[job.queueName];
  if (!projectHandlers) return null;
  return typeof projectHandlers[job.name] === "function"
    ? projectHandlers[job.name]
    : null;
}

async function processJob(job) {
  const handler = resolveHandler(job);
  if (!handler) {
    throw new UnrecoverableError(
      `No handler for queue=${job.queueName} job=${job.name}`,
    );
  }

  await handler(job.data, job);
}

async function runWorker() {
  const worker = new Worker(TODO_QUEUE, processJob, workerOptions);

  worker.on("ready", () => {
    console.log(
      `[${WORKER_ID}] listening on queue=${TODO_QUEUE} concurrency=${workerOptions.concurrency}`,
    );
  });

  worker.on("active", (job) => {
    console.log(
      `[${WORKER_ID}] active id=${job.id} name=${job.name} attempt=${job.attemptsMade + 1}`,
    );
  });

  worker.on("completed", (job) => {
    console.log(`[${WORKER_ID}] completed id=${job.id} name=${job.name}`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[${WORKER_ID}] failed id=${job?.id} name=${job?.name}: ${err.message}`,
    );
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[${WORKER_ID}] stalled id=${jobId}`);
  });

  worker.on("error", (err) => {
    console.error(`[${WORKER_ID}] error: ${err.message}`);
  });

  const shutdown = async (signal) => {
    console.log(`[${WORKER_ID}] ${signal} received, finishing in-flight jobs...`);
    try {
      await worker.close();
    } catch (error) {
      console.error(`[${WORKER_ID}] Error closing worker: ${error.message}`);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

runWorker().catch((error) => {
  console.error(`[${WORKER_ID}] Error: ${error.message}`);
  process.exit(1);
});

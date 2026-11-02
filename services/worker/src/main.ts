import pg from "pg";
import { Redis } from "ioredis";
import { loadWorkerConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createProducer, startWorkers, type JobHandler } from "./workers.js";
import { JOB_OPTIONS, MAX_OUTBOX_ATTEMPTS, SCHEDULE_TZ, type QueueName } from "./queues.js";
import { relayOnce } from "./outbox.js";
import { pgOutboxStore } from "./pg-outbox.js";
import { handleOrderEvent } from "./handlers/order-events.js";
import { expireAndReoffer } from "./handlers/dispatch-expire.js";
import { runMerchantSettlements } from "./handlers/settlement.js";
import { reconcile } from "./handlers/reconciliation.js";

// Worker process: no HTTP server. Starts the outbox poller, BullMQ workers and repeatable schedules.
const config = loadWorkerConfig();
const log = createLogger(config.NODE_ENV === "test" ? "warn" : "info");
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });
const { producer, queues } = createProducer(redis, JOB_OPTIONS);

const handlers: Record<QueueName, JobHandler> = {
  "order-events": async (_name, data) => handleOrderEvent(pool, log, data),
  "dispatch-expire": async (name) => {
    if (name === "tick") log.info(await expireAndReoffer(pool), "dispatch-expire tick");
  },
  settlement: async (name) => {
    if (name === "run") log.info({ created: await runMerchantSettlements(pool) }, "settlement run");
  },
  reconciliation: async (name) => {
    if (name === "run") log.info({ written: await reconcile(pool) }, "reconciliation run");
  },
};

const workers = startWorkers(redis, handlers, producer, log);

const schedulers = [
  queues.get("dispatch-expire")?.upsertJobScheduler("dispatch-expire-tick", { every: 10_000 }, { name: "tick" }),
  queues.get("settlement")?.upsertJobScheduler("settlement-daily", { pattern: "0 2 * * *", tz: SCHEDULE_TZ }, { name: "run" }),
  queues.get("reconciliation")?.upsertJobScheduler("reconciliation-daily", { pattern: "0 4 * * *", tz: SCHEDULE_TZ }, { name: "run" }),
];
await Promise.all(schedulers);

const store = pgOutboxStore(pool);
let relaying = false;
const poll = setInterval(() => {
  if (relaying) return;
  relaying = true;
  relayOnce(store, producer, config.OUTBOX_BATCH_SIZE)
    .then((r) => {
      if (r.claimed > 0) log.info(r, "outbox relay");
    })
    .catch((err: unknown) => log.error({ err }, "outbox relay failed"))
    .finally(() => {
      relaying = false;
    });
}, config.OUTBOX_POLL_MS);

log.info({ maxOutboxAttempts: MAX_OUTBOX_ATTEMPTS }, "worker started");

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, "shutting down");
  clearInterval(poll);
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([...queues.values()].map((q) => q.close()));
  redis.disconnect();
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

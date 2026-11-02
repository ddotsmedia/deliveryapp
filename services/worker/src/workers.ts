import { Queue, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "./logger.js";
import type { Producer } from "./producer.js";
import { routeToDlq } from "./dlq.js";
import { MAX_JOB_ATTEMPTS, WORKER_CONCURRENCY, type QueueName } from "./queues.js";

export type JobHandler = (name: string, data: unknown) => Promise<void>;

export function createProducer(redis: Redis, jobOptions: object): { producer: Producer; queues: Map<string, Queue> } {
  const queues = new Map<string, Queue>();
  const get = (name: string): Queue => {
    let q = queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: redis });
      queues.set(name, q);
    }
    return q;
  };
  const producer: Producer = {
    async enqueue(queue, name, data, opts) {
      await get(queue).add(name, data, { ...jobOptions, ...(opts?.jobId ? { jobId: opts.jobId } : {}) });
    },
  };
  return { producer, queues };
}

export function startWorkers(
  redis: Redis,
  handlers: Record<QueueName, JobHandler>,
  producer: Producer,
  log: Logger,
): Worker[] {
  return (Object.keys(handlers) as QueueName[]).map((queueName) => {
    const worker = new Worker(
      queueName,
      async (job: Job) => handlers[queueName](job.name, job.data),
      { connection: redis, concurrency: WORKER_CONCURRENCY },
    );
    worker.on("failed", (job, err) => {
      if (!job) return;
      void routeToDlq(
        producer,
        { queueName, name: job.name, ...(job.id !== undefined ? { id: job.id } : {}), data: job.data, attemptsMade: job.attemptsMade },
        job.opts.attempts ?? MAX_JOB_ATTEMPTS,
        err.message,
      ).catch((dlqErr: unknown) => log.error({ err: dlqErr, queue: queueName }, "dlq routing failed"));
    });
    return worker;
  });
}

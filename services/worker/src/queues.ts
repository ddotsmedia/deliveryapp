export const QUEUES = ["order-events", "dispatch-expire", "settlement", "reconciliation"] as const;
export type QueueName = (typeof QUEUES)[number];

export const WORKER_CONCURRENCY = 5;
export const MAX_JOB_ATTEMPTS = 3;
export const MAX_OUTBOX_ATTEMPTS = 5;
export const OFFER_TTL_SECONDS = 20;
export const SCHEDULE_TZ = "Asia/Dubai";

export const JOB_OPTIONS = {
  attempts: MAX_JOB_ATTEMPTS,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: false,
} as const;

export const dlqName = (queue: string): string => `${queue}-dlq`;

// Outbox topic -> BullMQ queue. Unknown topics are failed in the outbox, never dropped.
export function routeTopic(topic: string): QueueName | undefined {
  if (topic.startsWith("order.")) return "order-events";
  if (topic.startsWith("dispatch.")) return "dispatch-expire";
  return undefined;
}

export function shouldDeadLetter(attemptsMade: number, maxAttempts: number): boolean {
  return attemptsMade >= maxAttempts;
}

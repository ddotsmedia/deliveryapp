import { dlqName, shouldDeadLetter } from "./queues.js";
import type { Producer } from "./producer.js";

export type FailedJob = { queueName: string; name: string; id?: string; data: unknown; attemptsMade: number };

export type DlqEntry = {
  originalQueue: string;
  jobName: string;
  jobId?: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
};

export function buildDlqEntry(job: FailedJob, reason: string): DlqEntry {
  return {
    originalQueue: job.queueName,
    jobName: job.name,
    ...(job.id !== undefined ? { jobId: job.id } : {}),
    data: job.data,
    failedReason: reason,
    attemptsMade: job.attemptsMade,
  };
}

// Returns true when the job was moved to its dead-letter queue.
export async function routeToDlq(producer: Producer, job: FailedJob, maxAttempts: number, reason: string): Promise<boolean> {
  if (!shouldDeadLetter(job.attemptsMade, maxAttempts)) return false;
  await producer.enqueue(dlqName(job.queueName), job.name, buildDlqEntry(job, reason));
  return true;
}

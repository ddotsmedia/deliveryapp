export type EnqueueOptions = { jobId?: string };

// Thin port over BullMQ so relay and DLQ logic can be tested without Redis.
export interface Producer {
  enqueue(queue: string, name: string, data: unknown, opts?: EnqueueOptions): Promise<void>;
}

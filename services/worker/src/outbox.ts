import { MAX_OUTBOX_ATTEMPTS, routeTopic } from "./queues.js";
import type { Producer } from "./producer.js";

export type OutboxRow = { id: string; topic: string; payload: unknown; attempts: number };

export interface OutboxStore {
  // Returns up to `limit` PENDING rows and marks them PROCESSING in one transaction.
  claimPending(limit: number): Promise<OutboxRow[]>;
  markSent(id: string): Promise<void>;
  // Non-final failure returns the row to PENDING with attempts+1; final sets FAILED.
  markFailed(id: string, error: string, final: boolean): Promise<void>;
}

export type RelayResult = { claimed: number; sent: number; failed: number };

export async function relayOnce(store: OutboxStore, producer: Producer, limit: number): Promise<RelayResult> {
  const rows = await store.claimPending(limit);
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const queue = routeTopic(row.topic);
      if (!queue) throw new Error(`no queue route for topic ${row.topic}`);
      // jobId = outbox id: a retried relay of the same row cannot create a second job.
      await producer.enqueue(queue, row.topic, row.payload, { jobId: row.id });
      await store.markSent(row.id);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.markFailed(row.id, message, row.attempts + 1 >= MAX_OUTBOX_ATTEMPTS);
      failed++;
    }
  }
  return { claimed: rows.length, sent, failed };
}

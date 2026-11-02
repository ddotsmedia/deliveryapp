import { describe, expect, it } from "vitest";
import { relayOnce, type OutboxRow, type OutboxStore } from "../src/outbox.js";
import type { Producer } from "../src/producer.js";
import { MAX_OUTBOX_ATTEMPTS } from "../src/queues.js";

// Fake store + fake queue (no Redis, no Postgres).
function fakeStore(rows: OutboxRow[]) {
  const calls = { claimLimit: 0, sent: [] as string[], failed: [] as { id: string; error: string; final: boolean }[] };
  const store: OutboxStore = {
    async claimPending(limit) {
      calls.claimLimit = limit;
      return rows.slice(0, limit);
    },
    async markSent(id) {
      calls.sent.push(id);
    },
    async markFailed(id, error, final) {
      calls.failed.push({ id, error, final });
    },
  };
  return { store, calls };
}

function fakeQueue(failFor?: string) {
  const jobs: { queue: string; name: string; jobId?: string }[] = [];
  const producer: Producer = {
    async enqueue(queue, name, _data, opts) {
      if (failFor && name === failFor) throw new Error("redis unavailable");
      jobs.push({ queue, name, ...(opts?.jobId ? { jobId: opts.jobId } : {}) });
    },
  };
  return { producer, jobs };
}

const row = (id: string, topic: string, attempts = 0): OutboxRow => ({ id, topic, payload: { orderId: id }, attempts });

describe("outbox relay", () => {
  it("routes order topics to order-events, uses outbox id as jobId, marks SENT", async () => {
    const { store, calls } = fakeStore([row("00000000-0000-4000-8000-000000000001", "order.status_changed")]);
    const { producer, jobs } = fakeQueue();
    const result = await relayOnce(store, producer, 100);
    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(jobs).toEqual([{ queue: "order-events", name: "order.status_changed", jobId: "00000000-0000-4000-8000-000000000001" }]);
    expect(calls.sent).toEqual(["00000000-0000-4000-8000-000000000001"]);
  });

  it("honours the batch limit", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`00000000-0000-4000-8000-00000000000${i + 1}`, "order.status_changed"));
    const { store, calls } = fakeStore(rows);
    const result = await relayOnce(store, fakeQueue().producer, 2);
    expect(calls.claimLimit).toBe(2);
    expect(result.claimed).toBe(2);
  });

  it("fails unroutable topics back to PENDING on the first attempt", async () => {
    const { store, calls } = fakeStore([row("00000000-0000-4000-8000-0000000000aa", "unknown.topic")]);
    const result = await relayOnce(store, fakeQueue().producer, 100);
    expect(result.failed).toBe(1);
    expect(calls.failed).toEqual([
      { id: "00000000-0000-4000-8000-0000000000aa", error: "no queue route for topic unknown.topic", final: false },
    ]);
  });

  it("marks a row FAILED on the fifth attempt", async () => {
    const { store, calls } = fakeStore([row("00000000-0000-4000-8000-0000000000bb", "order.x", MAX_OUTBOX_ATTEMPTS - 1)]);
    const { producer } = fakeQueue("order.x");
    await relayOnce(store, producer, 100);
    expect(calls.failed[0]).toMatchObject({ final: true, error: "redis unavailable" });
  });
});

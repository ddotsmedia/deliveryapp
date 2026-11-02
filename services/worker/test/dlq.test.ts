import { describe, expect, it } from "vitest";
import { buildDlqEntry, routeToDlq } from "../src/dlq.js";
import { shouldDeadLetter } from "../src/queues.js";
import type { Producer } from "../src/producer.js";

describe("dead-letter routing", () => {
  it("dead-letters only when attempts are exhausted", () => {
    expect(shouldDeadLetter(3, 3)).toBe(true);
    expect(shouldDeadLetter(2, 3)).toBe(false);
  });

  it("sends exhausted jobs to {queue}-dlq and keeps the original context", async () => {
    const sent: { queue: string; name: string; data: unknown }[] = [];
    const producer: Producer = {
      async enqueue(queue, name, data) {
        sent.push({ queue, name, data });
      },
    };
    const job = { queueName: "order-events", name: "order.status_changed", id: "j1", data: { orderId: "x" }, attemptsMade: 3 };
    expect(await routeToDlq(producer, job, 3, "boom")).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.queue).toBe("order-events-dlq");
    expect(sent[0]?.data).toEqual({ originalQueue: "order-events", jobName: "order.status_changed", jobId: "j1", data: { orderId: "x" }, failedReason: "boom", attemptsMade: 3 });
  });

  it("does not route a job that still has retries left", async () => {
    const producer: Producer = { async enqueue() { throw new Error("must not enqueue"); } };
    const job = { queueName: "settlement", name: "run", data: {}, attemptsMade: 1 };
    expect(await routeToDlq(producer, job, 3, "transient")).toBe(false);
  });

  it("builds an entry without jobId when the job has none", () => {
    const entry = buildDlqEntry({ queueName: "reconciliation", name: "run", data: null, attemptsMade: 3 }, "x");
    expect("jobId" in entry).toBe(false);
  });
});

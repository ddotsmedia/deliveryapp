import { and, eq, sql } from "drizzle-orm";
import { allowedNext, canTransition, type OrderStatus } from "../../domain/order-state-machine.js";
import { conflict, invalidTransition, notFound } from "../../common/errors.js";
import type { Tx } from "../../db/tx.js";
import { orderEvents, orders, outboxMessages } from "../../db/schema/index.js";

export type TransitionInput = {
  orderId: string;
  to: OrderStatus;
  actorId?: string | null;
  actorRole?: string;
  metadata?: Record<string, unknown>;
};

// The only place an order status changes. Must run inside a transaction, and writes
// order_events and outbox_messages in that same transaction.
export async function transitionOrder(tx: Tx, input: TransitionInput): Promise<OrderStatus> {
  const [current] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!current) throw notFound("Order");
  const from: OrderStatus = current.status;
  if (from === input.to) throw conflict("ALREADY_IN_STATE", `Order is already ${input.to}`);
  if (!canTransition(from, input.to)) throw invalidTransition(from, input.to, allowedNext(from));

  // Conditional UPDATE: loses cleanly if another request moved the order first.
  const updated = await tx
    .update(orders)
    .set({ status: input.to, version: sql`${orders.version} + 1`, updatedAt: new Date() })
    .where(and(eq(orders.id, input.orderId), eq(orders.status, from)))
    .returning({ id: orders.id });
  if (updated.length === 0) throw conflict("STALE_STATE", "Order changed concurrently; retry");

  await tx.insert(orderEvents).values({
    orderId: input.orderId,
    status: input.to,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    metadata: input.metadata ?? {},
  });
  await tx.insert(outboxMessages).values({
    topic: "order.status_changed",
    payload: { orderId: input.orderId, from, to: input.to },
  });
  return input.to;
}

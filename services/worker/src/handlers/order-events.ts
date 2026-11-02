import { z } from "zod";
import type pg from "pg";
import type { Logger } from "../logger.js";
import { notify } from "../notify.js";
import type { TemplateName } from "../templates.js";

// Payload written by the API transition helper (outbox topic order.status_changed).
export const orderEventSchema = z.object({
  orderId: z.uuid(),
  from: z.string(),
  to: z.string(),
});

const TO_TEMPLATE: Partial<Record<string, TemplateName>> = {
  MERCHANT_PENDING: "ORDER_PLACED",
  ACCEPTED: "ORDER_ACCEPTED",
  READY: "ORDER_READY",
  PICKED_UP: "ORDER_PICKED_UP",
  DELIVERED: "ORDER_DELIVERED",
};

// Ledger entries for DELIVERED are written by the API in the same transaction; this handler only notifies.
export async function handleOrderEvent(pool: pg.Pool, log: Logger, data: unknown): Promise<void> {
  const event = orderEventSchema.parse(data);
  const template = TO_TEMPLATE[event.to];
  if (!template) return;
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT cp.user_id FROM orders o JOIN customer_profiles cp ON cp.id = o.customer_id WHERE o.id = $1`,
    [event.orderId],
  );
  const userId = rows[0]?.user_id;
  if (!userId) {
    log.warn({ orderId: event.orderId }, "order-events: no customer for order");
    return;
  }
  await notify(pool, log, userId, template, { orderId: event.orderId, status: event.to });
}

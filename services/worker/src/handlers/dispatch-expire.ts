import type pg from "pg";
import { OFFER_TTL_SECONDS } from "../queues.js";
import { uuidv7 } from "../uuid.js";

export type ExpireResult = { expired: number; reoffered: number };

// Every 10 s: expire stale PENDING offers, then re-offer READY unassigned orders to online couriers
// in the zone who have not already received an offer for that order.
export async function expireAndReoffer(pool: pg.Pool): Promise<ExpireResult> {
  const expired = await pool.query<{ order_id: string }>(
    `UPDATE dispatch_offers SET status = 'EXPIRED', responded_at = now()
      WHERE status = 'PENDING' AND expires_at <= now()
      RETURNING order_id`,
  );
  const orderIds = [...new Set(expired.rows.map((r) => r.order_id))];
  if (orderIds.length === 0) return { expired: 0, reoffered: 0 };

  const reoffered = await pool.query(
    `INSERT INTO dispatch_offers (id, order_id, courier_id, zone_id, status, expires_at)
     SELECT $3::uuid, o.id, cs.courier_id, o.zone_id, 'PENDING', now() + make_interval(secs => $2)
       FROM orders o
       JOIN LATERAL (
         SELECT DISTINCT s.courier_id FROM courier_shifts s
          WHERE s.zone_id = o.zone_id AND s.status = 'ONLINE' AND s.ended_at IS NULL
       ) cs ON true
      WHERE o.id = ANY($1::uuid[])
        AND o.status = 'READY'
        AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.order_id = o.id)
        AND NOT EXISTS (SELECT 1 FROM dispatch_offers d WHERE d.order_id = o.id AND d.status = 'PENDING')
        AND NOT EXISTS (SELECT 1 FROM dispatch_offers d2 WHERE d2.order_id = o.id AND d2.courier_id = cs.courier_id)`,
    [orderIds, OFFER_TTL_SECONDS, uuidv7()],
  );
  return { expired: expired.rowCount ?? 0, reoffered: reoffered.rowCount ?? 0 };
}

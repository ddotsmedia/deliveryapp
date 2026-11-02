import type pg from "pg";
import { uuidv7 } from "../uuid.js";

export type Mismatch = { orderId: string; reason: "DELIVERED_WITHOUT_LEDGER" | "PAYMENT_AMOUNT_MISMATCH" };

// Read-only comparison of payment intents and ledger against orders; writes one audit row per new mismatch per day.
export async function reconcile(pool: pg.Pool): Promise<number> {
  const found = await pool.query<{ order_id: string; reason: Mismatch["reason"] }>(
    `SELECT o.id AS order_id, 'DELIVERED_WITHOUT_LEDGER' AS reason
       FROM orders o
      WHERE o.status = 'DELIVERED'
        AND NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.reference_type = 'ORDER' AND le.reference_id = o.id)
     UNION ALL
     SELECT pi.order_id, 'PAYMENT_AMOUNT_MISMATCH'
       FROM payment_intents pi
       JOIN orders o ON o.id = pi.order_id
       JOIN quotes q ON q.id = o.quote_id
      WHERE pi.amount_fils <> q.total_fils`,
  );
  let written = 0;
  for (const m of found.rows) {
    const inserted = await pool.query(
      `INSERT INTO audit_events (id, actor_role, action, resource_type, resource_id, after_state)
       SELECT $3::uuid, 'SYSTEM', 'reconciliation.mismatch', 'order', $1::uuid, $2::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM audit_events WHERE action = 'reconciliation.mismatch'
             AND resource_id = $1 AND created_at > now() - interval '1 day')`,
      [m.order_id, JSON.stringify({ reason: m.reason }), uuidv7()],
    );
    written += inserted.rowCount ?? 0;
  }
  return written;
}

import type pg from "pg";
import { SCHEDULE_TZ } from "../queues.js";
import { uuidv7 } from "../uuid.js";

export type Period = { start: Date; end: Date; date: string };

// Yesterday in Asia/Dubai as [00:00, 24:00) instants.
export function previousDubaiDay(now: Date = new Date()): Period {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: SCHEDULE_TZ }).format(now);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const todayStart = new Date(Date.UTC(y, m - 1, d) - 4 * 3600_000);
  const start = new Date(todayStart.getTime() - 24 * 3600_000);
  return { start, end: todayStart, date: new Intl.DateTimeFormat("en-CA", { timeZone: SCHEDULE_TZ }).format(start) };
}

// gross = delivered subtotal; net = merchant payable credits minus debits (from ledger); commission = gross - net.
export async function generateMerchantSettlement(pool: pg.Pool, orgId: string, period: Period): Promise<boolean> {
  const exists = await pool.query(
    `SELECT 1 FROM merchant_settlements WHERE org_id = $1 AND period_start = $2 AND period_end = $2`,
    [orgId, period.date],
  );
  if ((exists.rowCount ?? 0) > 0) return false;

  const gross = await pool.query<{ gross: string }>(
    `SELECT COALESCE(SUM(q.subtotal_fils), 0) AS gross
       FROM orders o
       JOIN quotes q ON q.id = o.quote_id
       JOIN branches b ON b.id = o.branch_id
       JOIN restaurants r ON r.id = b.restaurant_id
      WHERE r.org_id = $1 AND o.status = 'DELIVERED' AND o.updated_at >= $2 AND o.updated_at < $3`,
    [orgId, period.start, period.end],
  );
  const net = await pool.query<{ net: string }>(
    `SELECT COALESCE(SUM(le.credit_fils - le.debit_fils), 0) AS net
       FROM ledger_entries le
       JOIN ledger_accounts la ON la.id = le.account_id
      WHERE la.type = 'LIABILITY' AND la.owner_type = 'MERCHANT' AND la.owner_id = $1
        AND le.created_at >= $2 AND le.created_at < $3`,
    [orgId, period.start, period.end],
  );
  const grossFils = Number(gross.rows[0]?.gross ?? 0);
  const netFils = Number(net.rows[0]?.net ?? 0);
  await pool.query(
    `INSERT INTO merchant_settlements (id, org_id, period_start, period_end, gross_fils, commission_fils, net_fils, status)
     VALUES ($1, $2, $3, $3, $4, $5, $6, 'PENDING')`,
    [uuidv7(), orgId, period.date, grossFils, grossFils - netFils, netFils],
  );
  return true;
}

export async function runMerchantSettlements(pool: pg.Pool, now: Date = new Date()): Promise<number> {
  const period = previousDubaiDay(now);
  const orgs = await pool.query<{ id: string }>(`SELECT id FROM merchant_organizations WHERE status = 'ACTIVE'`);
  let created = 0;
  for (const org of orgs.rows) {
    if (await generateMerchantSettlement(pool, org.id, period)) created++;
  }
  return created;
}

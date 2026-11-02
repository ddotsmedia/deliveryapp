import type pg from "pg";
import type { OutboxRow, OutboxStore } from "./outbox.js";

// Rows stuck in PROCESSING longer than this (worker crashed mid-relay) are claimed again.
const STALE_PROCESSING_INTERVAL = "5 minutes";

export function pgOutboxStore(pool: pg.Pool): OutboxStore {
  return {
    async claimPending(limit: number): Promise<OutboxRow[]> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query<OutboxRow>(
          `SELECT id, topic, payload, attempts FROM outbox_messages
           WHERE status = 'PENDING'
              OR (status = 'PROCESSING' AND created_at < now() - interval '${STALE_PROCESSING_INTERVAL}')
           ORDER BY created_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED`,
          [limit],
        );
        if (rows.length > 0) {
          await client.query(`UPDATE outbox_messages SET status = 'PROCESSING' WHERE id = ANY($1::uuid[])`, [rows.map((r) => r.id)]);
        }
        await client.query("COMMIT");
        return rows;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    async markSent(id: string): Promise<void> {
      await pool.query(`UPDATE outbox_messages SET status = 'SENT', processed_at = now() WHERE id = $1`, [id]);
    },
    async markFailed(id: string, error: string, final: boolean): Promise<void> {
      await pool.query(
        `UPDATE outbox_messages
            SET status = CASE WHEN $3 THEN 'FAILED' ELSE 'PENDING' END,
                attempts = attempts + 1,
                last_error = $2
          WHERE id = $1`,
        [id, error, final],
      );
    },
  };
}

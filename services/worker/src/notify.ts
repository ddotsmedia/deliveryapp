import { uuidv7 } from "./uuid.js";
import type pg from "pg";
import type { Logger } from "./logger.js";
import type { TemplateName } from "./templates.js";
import { renderBoth } from "./templates.js";

// Writes the in-app row. FCM push is a stub that only logs.
export async function notify(
  pool: pg.Pool,
  log: Logger,
  userId: string,
  template: TemplateName,
  data: Record<string, unknown>,
): Promise<void> {
  const text = renderBoth(template);
  await pool.query(`INSERT INTO notifications (id, user_id, template, data) VALUES ($1, $2, $3, $4)`, [
    uuidv7(),
    userId,
    template,
    JSON.stringify({ ...data, text }),
  ]);
  log.info({ userId, template }, "push stub: would send FCM message");
}

import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";

export const outboxStatus = pgEnum("outbox_status", ["PENDING", "PROCESSING", "SENT", "FAILED"]);

const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const outboxMessages = pgTable("outbox_messages", {
  id: id(),
  topic: varchar("topic", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: outboxStatus("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: ts("created_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
}, (t) => [index("outbox_status_idx").on(t.status, t.createdAt)]);

// Webhook dedupe: one row per provider event id.
export const processedWebhookEvents = pgTable("processed_webhook_events", {
  eventId: varchar("event_id", { length: 128 }).primaryKey(),
  provider: varchar("provider", { length: 30 }).notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
});

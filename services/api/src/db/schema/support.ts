import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";
import { users } from "./identity.js";
import { orders } from "./commerce.js";

export const ticketCategory = pgEnum("ticket_category", ["ORDER", "PAYMENT", "DELIVERY", "ACCOUNT", "OTHER"]);
export const ticketStatus = pgEnum("ticket_status", ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const tickets = pgTable("tickets", {
  id: id(),
  orderId: uuid("order_id").references(() => orders.id),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  category: ticketCategory("category").notNull(),
  status: ticketStatus("status").notNull().default("OPEN"),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const ticketMessages = pgTable("ticket_messages", {
  id: id(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id),
  authorId: uuid("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Append-only: UPDATE/DELETE rejected by trigger (custom migration).
export const auditEvents = pgTable("audit_events", {
  id: id(),
  actorId: uuid("actor_id"),
  actorRole: varchar("actor_role", { length: 40 }),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 60 }).notNull(),
  resourceId: uuid("resource_id"),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  ipAddress: varchar("ip_address", { length: 64 }),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("audit_resource_idx").on(t.resourceType, t.resourceId)]);

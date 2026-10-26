import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";
import { branches, zones } from "./catalog.js";
import { customerProfiles, users } from "./identity.js";
import { customerAddresses } from "./addresses.js";

export const orderStatus = pgEnum("order_status", [
  "PLACED", "PAYMENT_AUTHORIZED", "MERCHANT_PENDING", "ACCEPTED", "PREPARING",
  "READY", "PICKED_UP", "DELIVERED", "REJECTED", "CANCELLED", "FAILED", "REFUNDED",
]);
export const paymentStatus = pgEnum("payment_status", ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"]);
export const refundStatus = pgEnum("refund_status", ["PENDING", "PROCESSED", "FAILED"]);

const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const carts = pgTable("carts", {
  id: id(),
  customerId: uuid("customer_id").notNull().references(() => customerProfiles.id),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  items: jsonb("items").notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const quotes = pgTable("quotes", {
  id: id(),
  cartId: uuid("cart_id").notNull().references(() => carts.id),
  customerId: uuid("customer_id").notNull().references(() => customerProfiles.id),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  zoneId: uuid("zone_id").notNull().references(() => zones.id),
  subtotalFils: integer("subtotal_fils").notNull(),
  deliveryFeeFils: integer("delivery_fee_fils").notNull(),
  serviceFeeFils: integer("service_fee_fils").notNull(),
  vatFils: integer("vat_fils").notNull(),
  tipFils: integer("tip_fils").notNull().default(0),
  totalFils: integer("total_fils").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: createdAt(),
});

export const orders = pgTable("orders", {
  id: id(),
  quoteId: uuid("quote_id").notNull().unique().references(() => quotes.id),
  customerId: uuid("customer_id").notNull().references(() => customerProfiles.id),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  zoneId: uuid("zone_id").notNull().references(() => zones.id),
  addressId: uuid("address_id").notNull().references(() => customerAddresses.id),
  status: orderStatus("status").notNull().default("PLACED"),
  specialInstructions: text("special_instructions"),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull().unique(),
  version: integer("version").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("orders_status_idx").on(t.status), index("orders_zone_idx").on(t.zoneId)]);

export const orderEvents = pgTable("order_events", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  status: orderStatus("status").notNull(),
  actorId: uuid("actor_id"),
  actorRole: varchar("actor_role", { length: 40 }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: createdAt(),
}, (t) => [index("order_events_order_idx").on(t.orderId)]);

export const paymentIntents = pgTable("payment_intents", {
  id: id(),
  orderId: uuid("order_id").notNull().unique().references(() => orders.id),
  provider: varchar("provider", { length: 30 }).notNull().default("mock"),
  providerIntentId: varchar("provider_intent_id", { length: 100 }).unique(),
  status: paymentStatus("status").notNull().default("PENDING"),
  amountFils: integer("amount_fils").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const refunds = pgTable("refunds", {
  id: id(),
  paymentIntentId: uuid("payment_intent_id").notNull().references(() => paymentIntents.id),
  initiatedBy: uuid("initiated_by").notNull().references(() => users.id),
  amountFils: integer("amount_fils").notNull(),
  reasonCode: varchar("reason_code", { length: 40 }).notNull(),
  reasonNotes: text("reason_notes"),
  providerRefundId: varchar("provider_refund_id", { length: 100 }),
  status: refundStatus("status").notNull().default("PENDING"),
  createdAt: createdAt(),
});

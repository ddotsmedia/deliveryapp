import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";
import { courierProfiles } from "./identity.js";
import { zones } from "./catalog.js";
import { orders } from "./commerce.js";

export const shiftStatus = pgEnum("shift_status", ["ONLINE", "OFFLINE", "BUSY"]);
export const offerStatus = pgEnum("offer_status", ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"]);

const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const courierShifts = pgTable("courier_shifts", {
  id: id(),
  courierId: uuid("courier_id").notNull().references(() => courierProfiles.id),
  zoneId: uuid("zone_id").notNull().references(() => zones.id),
  status: shiftStatus("status").notNull().default("OFFLINE"),
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("shifts_zone_status_idx").on(t.zoneId, t.status)]);

export const dispatchOffers = pgTable("dispatch_offers", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  courierId: uuid("courier_id").notNull().references(() => courierProfiles.id),
  zoneId: uuid("zone_id").notNull().references(() => zones.id),
  status: offerStatus("status").notNull().default("PENDING"),
  offeredAt: ts("offered_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  respondedAt: ts("responded_at"),
}, (t) => [index("offers_order_idx").on(t.orderId), index("offers_status_expiry_idx").on(t.status, t.expiresAt)]);

export const assignments = pgTable("assignments", {
  id: id(),
  orderId: uuid("order_id").notNull().unique().references(() => orders.id),
  courierId: uuid("courier_id").notNull().references(() => courierProfiles.id),
  offerId: uuid("offer_id").notNull().unique().references(() => dispatchOffers.id),
  zoneId: uuid("zone_id").notNull().references(() => zones.id),
  assignedAt: ts("assigned_at").notNull().defaultNow(),
  pickedUpAt: ts("picked_up_at"),
  deliveredAt: ts("delivered_at"),
});

export const proofOfDelivery = pgTable("proof_of_delivery", {
  id: id(),
  assignmentId: uuid("assignment_id").notNull().unique().references(() => assignments.id),
  photoUrl: text("photo_url").notNull(),
  signatureUrl: text("signature_url"),
  deliveredAt: ts("delivered_at").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

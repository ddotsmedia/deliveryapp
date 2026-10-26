import { boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";
import { geoPoint } from "../types.js";
import { customerProfiles } from "./identity.js";

export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  customerId: uuid("customer_id").notNull().references(() => customerProfiles.id),
  label: varchar("label", { length: 60 }),
  addressLine1: varchar("address_line1", { length: 200 }).notNull(),
  apartment: varchar("apartment", { length: 60 }),
  location: geoPoint("location").notNull(),
  instructions: text("instructions"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

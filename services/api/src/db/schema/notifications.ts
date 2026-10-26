import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";
import { users } from "./identity.js";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  userId: uuid("user_id").notNull().references(() => users.id),
  template: varchar("template", { length: 60 }).notNull(),
  data: jsonb("data").notNull().default({}),
  readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]);

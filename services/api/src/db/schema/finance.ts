import { check, date, index, integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { uuidv7 } from "../uuid.js";
import { merchantOrganizations, courierProfiles } from "./identity.js";

export const accountType = pgEnum("account_type", ["REVENUE", "LIABILITY", "ASSET", "EQUITY"]);
export const accountOwner = pgEnum("account_owner", ["PLATFORM", "MERCHANT", "COURIER"]);
export const settlementStatus = pgEnum("settlement_status", ["PENDING", "PAID"]);

const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const ledgerAccounts = pgTable("ledger_accounts", {
  id: id(),
  type: accountType("type").notNull(),
  ownerType: accountOwner("owner_type").notNull(),
  ownerId: uuid("owner_id"),
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: id(),
  accountId: uuid("account_id").notNull().references(() => ledgerAccounts.id),
  referenceType: varchar("reference_type", { length: 40 }).notNull(),
  referenceId: uuid("reference_id").notNull(),
  debitFils: integer("debit_fils").notNull().default(0),
  creditFils: integer("credit_fils").notNull().default(0),
  description: varchar("description", { length: 200 }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [
  check("ledger_non_negative", sql`${t.debitFils} >= 0 AND ${t.creditFils} >= 0`),
  check("ledger_one_side", sql`NOT (${t.debitFils} > 0 AND ${t.creditFils} > 0)`),
  index("ledger_ref_idx").on(t.referenceType, t.referenceId),
]);

export const merchantSettlements = pgTable("merchant_settlements", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => merchantOrganizations.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  grossFils: integer("gross_fils").notNull(),
  commissionFils: integer("commission_fils").notNull(),
  netFils: integer("net_fils").notNull(),
  status: settlementStatus("status").notNull().default("PENDING"),
  paidAt: ts("paid_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const courierPayouts = pgTable("courier_payouts", {
  id: id(),
  courierId: uuid("courier_id").notNull().references(() => courierProfiles.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  amountFils: integer("amount_fils").notNull(),
  status: settlementStatus("status").notNull().default("PENDING"),
  paidAt: ts("paid_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

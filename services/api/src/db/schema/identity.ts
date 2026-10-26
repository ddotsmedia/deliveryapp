import { boolean, index, integer, pgEnum, pgTable, timestamp, uuid, varchar, unique } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";

export const userRole = pgEnum("user_role", [
  "CUSTOMER", "MERCHANT_OWNER", "MERCHANT_STAFF", "COURIER",
  "DISPATCHER", "SUPPORT", "FINANCE", "SUPER_ADMIN",
]);
export const userStatus = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]);
export const otpPurpose = pgEnum("otp_purpose", ["LOGIN", "REGISTER", "VERIFY"]);
export const language = pgEnum("language", ["en", "ar"]);
export const orgStatus = pgEnum("org_status", ["PENDING", "ACTIVE", "SUSPENDED"]);
export const vehicleType = pgEnum("vehicle_type", ["BICYCLE", "MOTORBIKE", "CAR", "WALK"]);
export const courierStatus = pgEnum("courier_status", ["PENDING", "ACTIVE", "SUSPENDED"]);

const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 254 }).unique(),
  role: userRole("role").notNull(),
  status: userStatus("status").notNull().default("PENDING_VERIFICATION"),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  refreshTokenHash: varchar("refresh_token_hash", { length: 128 }).notNull().unique(),
  deviceFingerprint: varchar("device_fingerprint", { length: 128 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const otpCodes = pgTable("otp_codes", {
  id: id(),
  phone: varchar("phone", { length: 20 }).notNull(),
  purpose: otpPurpose("purpose").notNull(),
  codeHash: varchar("code_hash", { length: 128 }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
}, (t) => [index("otp_phone_idx").on(t.phone)]);

export const customerProfiles = pgTable("customer_profiles", {
  id: id(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  nameFirst: varchar("name_first", { length: 100 }).notNull(),
  nameLast: varchar("name_last", { length: 100 }),
  preferredLanguage: language("preferred_language").notNull().default("en"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const merchantOrganizations = pgTable("merchant_organizations", {
  id: id(),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  tradeLicenseNumber: varchar("trade_license_number", { length: 60 }).unique(),
  vatTrn: varchar("vat_trn", { length: 30 }),
  status: orgStatus("status").notNull().default("PENDING"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const merchantStaff = pgTable("merchant_staff", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  orgId: uuid("org_id").notNull().references(() => merchantOrganizations.id),
  role: varchar("role", { length: 40 }).notNull(),
  createdAt: createdAt(),
}, (t) => [unique("merchant_staff_user_org").on(t.userId, t.orgId)]);

export const courierProfiles = pgTable("courier_profiles", {
  id: id(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  vehicleType: vehicleType("vehicle_type").notNull(),
  status: courierStatus("status").notNull().default("PENDING"),
  emiratesIdVerified: boolean("emirates_id_verified").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

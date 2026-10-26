import { boolean, index, integer, numeric, pgTable, text, time, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";
import { geoPoint, geoPolygon } from "../types.js";
import { merchantOrganizations } from "./identity.js";

const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const zones = pgTable("zones", {
  id: id(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  city: varchar("city", { length: 60 }).notNull(),
  boundary: geoPolygon("boundary").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const restaurants = pgTable("restaurants", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => merchantOrganizations.id),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  cuisineTypes: text("cuisine_types").array().notNull().default([]),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull().default("0.2000"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const branches = pgTable("branches", {
  id: id(),
  restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  zoneId: uuid("zone_id").notNull().references(() => zones.id),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  addressLine1: varchar("address_line1", { length: 200 }).notNull(),
  addressLine2: varchar("address_line2", { length: 200 }),
  location: geoPoint("location").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("branches_zone_idx").on(t.zoneId)]);

export const branchSchedules = pgTable("branch_schedules", {
  id: id(),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  dayOfWeek: integer("day_of_week").notNull(),
  openTime: time("open_time"),
  closeTime: time("close_time"),
  isClosed: boolean("is_closed").notNull().default(false),
});

export const menus = pgTable("menus", {
  id: id(),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const menuCategories = pgTable("menu_categories", {
  id: id(),
  menuId: uuid("menu_id").notNull().references(() => menus.id),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const menuItems = pgTable("menu_items", {
  id: id(),
  categoryId: uuid("category_id").notNull().references(() => menuCategories.id),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  basePriceFils: integer("base_price_fils").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  allergens: text("allergens").array().notNull().default([]),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const modifierGroups = pgTable("modifier_groups", {
  id: id(),
  itemId: uuid("item_id").notNull().references(() => menuItems.id),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  isRequired: boolean("is_required").notNull().default(false),
  isMultiSelect: boolean("is_multi_select").notNull().default(false),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const modifierOptions = pgTable("modifier_options", {
  id: id(),
  groupId: uuid("group_id").notNull().references(() => modifierGroups.id),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  priceAdjustmentFils: integer("price_adjustment_fils").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

import { Controller, Get, Inject, Module, Param, Query } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Public } from "../../common/auth.js";
import { notFound } from "../../common/errors.js";
import { uuidParam } from "../../common/schemas.js";
import type { DbHandle } from "../../infra/db.js";
import { branches, menuCategories, menuItems, menus, modifierGroups, modifierOptions, restaurants } from "../../db/schema/index.js";
import { DB } from "../../tokens.js";

// Public, read-only catalog. Commission rates are internal and never exposed here.
@Controller("v1")
export class CatalogController {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  @Public()
  @Get("restaurants")
  async list(@Query("zoneId") zoneId?: string) {
    const db = this.handle.db;
    const zone = zoneId ? uuidParam(zoneId) : undefined;
    const rows = await db
      .select({
        id: restaurants.id,
        nameEn: restaurants.nameEn,
        nameAr: restaurants.nameAr,
        cuisineTypes: restaurants.cuisineTypes,
        logoUrl: restaurants.logoUrl,
      })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.isActive, true),
          zone
            ? inArray(
                restaurants.id,
                db
                  .select({ id: branches.restaurantId })
                  .from(branches)
                  .where(and(eq(branches.zoneId, zone), eq(branches.isActive, true))),
              )
            : undefined,
        ),
      )
      .orderBy(asc(restaurants.nameEn));
    return rows;
  }

  @Public()
  @Get("restaurants/:id")
  async detail(@Param("id") id: string) {
    const restaurantId = uuidParam(id);
    const db = this.handle.db;
    const [restaurant] = await db
      .select({
        id: restaurants.id,
        nameEn: restaurants.nameEn,
        nameAr: restaurants.nameAr,
        descriptionEn: restaurants.descriptionEn,
        descriptionAr: restaurants.descriptionAr,
        cuisineTypes: restaurants.cuisineTypes,
        logoUrl: restaurants.logoUrl,
        bannerUrl: restaurants.bannerUrl,
      })
      .from(restaurants)
      .where(and(eq(restaurants.id, restaurantId), eq(restaurants.isActive, true)))
      .limit(1);
    if (!restaurant) throw notFound("Restaurant");
    const branchRows = await db
      .select({ id: branches.id, zoneId: branches.zoneId, nameEn: branches.nameEn, nameAr: branches.nameAr, addressLine1: branches.addressLine1 })
      .from(branches)
      .where(and(eq(branches.restaurantId, restaurantId), eq(branches.isActive, true)));
    return { ...restaurant, branches: branchRows };
  }

  @Public()
  @Get("branches/:id/menu")
  async menu(@Param("id") id: string) {
    const branchId = uuidParam(id);
    const db = this.handle.db;
    const menuRows = await db
      .select({ id: menus.id, nameEn: menus.nameEn, nameAr: menus.nameAr })
      .from(menus)
      .where(and(eq(menus.branchId, branchId), eq(menus.isActive, true)));
    const menuIds = menuRows.map((m) => m.id);
    if (menuIds.length === 0) return { branchId, menus: [] };

    const cats = await db
      .select()
      .from(menuCategories)
      .where(and(inArray(menuCategories.menuId, menuIds), eq(menuCategories.isActive, true)))
      .orderBy(asc(menuCategories.sortOrder));
    const catIds = cats.map((c) => c.id);
    const items = catIds.length
      ? await db.select().from(menuItems).where(inArray(menuItems.categoryId, catIds)).orderBy(asc(menuItems.sortOrder))
      : [];
    const itemIds = items.map((i) => i.id);
    const groups = itemIds.length
      ? await db.select().from(modifierGroups).where(inArray(modifierGroups.itemId, itemIds)).orderBy(asc(modifierGroups.sortOrder))
      : [];
    const groupIds = groups.map((g) => g.id);
    const options = groupIds.length
      ? await db.select().from(modifierOptions).where(inArray(modifierOptions.groupId, groupIds)).orderBy(asc(modifierOptions.sortOrder))
      : [];

    return {
      branchId,
      menus: menuRows.map((m) => ({
        ...m,
        categories: cats
          .filter((c) => c.menuId === m.id)
          .map((c) => ({
            id: c.id,
            nameEn: c.nameEn,
            nameAr: c.nameAr,
            items: items
              .filter((i) => i.categoryId === c.id)
              .map((i) => ({
                id: i.id,
                nameEn: i.nameEn,
                nameAr: i.nameAr,
                descriptionEn: i.descriptionEn,
                descriptionAr: i.descriptionAr,
                priceFils: i.basePriceFils,
                isAvailable: i.isAvailable,
                allergens: i.allergens,
                imageUrl: i.imageUrl,
                modifierGroups: groups
                  .filter((g) => g.itemId === i.id)
                  .map((g) => ({
                    id: g.id,
                    nameEn: g.nameEn,
                    nameAr: g.nameAr,
                    isRequired: g.isRequired,
                    isMultiSelect: g.isMultiSelect,
                    minSelect: g.minSelect,
                    maxSelect: g.maxSelect,
                    options: options
                      .filter((o) => o.groupId === g.id)
                      .map((o) => ({ id: o.id, nameEn: o.nameEn, nameAr: o.nameAr, priceAdjustmentFils: o.priceAdjustmentFils, isAvailable: o.isAvailable })),
                  })),
              })),
          })),
      })),
    };
  }
}

@Module({ controllers: [CatalogController] })
export class CatalogModule {}

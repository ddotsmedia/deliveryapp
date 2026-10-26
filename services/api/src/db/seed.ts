import { createDb, schema } from "./index.js";

// Fixed ids keep the seed idempotent across reruns.
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const zoneRings: Record<string, [number, number][]> = {
  reem: [[54.37, 24.48], [54.42, 24.48], [54.42, 24.51], [54.37, 24.51], [54.37, 24.48]],
  khalidiya: [[54.36, 24.46], [54.40, 24.46], [54.40, 24.48], [54.36, 24.48], [54.36, 24.46]],
  yas: [[54.59, 24.46], [54.63, 24.46], [54.63, 24.49], [54.59, 24.49], [54.59, 24.46]],
};

export async function seed(connectionString?: string): Promise<void> {
  const { db, pool } = createDb(connectionString);
  try {
    await db.transaction(async (tx) => {
      const now = new Date();

      await tx.insert(schema.zones).values([
        { id: id(1), nameEn: "Al Reem", nameAr: "الريم", city: "Abu Dhabi", boundary: zoneRings.reem! },
        { id: id(2), nameEn: "Al Khalidiya", nameAr: "الخالدية", city: "Abu Dhabi", boundary: zoneRings.khalidiya! },
        { id: id(3), nameEn: "Yas Island", nameAr: "جزيرة ياس", city: "Abu Dhabi", boundary: zoneRings.yas! },
      ]).onConflictDoNothing();

      // One user per role plus a second courier. Phones are fictional test numbers.
      const roles = ["CUSTOMER", "MERCHANT_OWNER", "MERCHANT_STAFF", "COURIER", "DISPATCHER", "SUPPORT", "FINANCE", "SUPER_ADMIN", "COURIER"] as const;
      await tx.insert(schema.users).values(
        roles.map((role, i) => ({
          id: id(100 + i),
          phone: `+9715550000${i}`,
          role,
          status: "ACTIVE" as const,
          phoneVerifiedAt: now,
        })),
      ).onConflictDoNothing();

      await tx.insert(schema.customerProfiles).values({
        id: id(200), userId: id(100), nameFirst: "Test", nameLast: "Customer", preferredLanguage: "en",
      }).onConflictDoNothing();

      await tx.insert(schema.courierProfiles).values([
        { id: id(300), userId: id(103), vehicleType: "MOTORBIKE", status: "ACTIVE", emiratesIdVerified: true },
        { id: id(301), userId: id(108), vehicleType: "BICYCLE", status: "ACTIVE", emiratesIdVerified: true },
      ]).onConflictDoNothing();

      const restaurantSeeds = [
        { name: ["Al Forno Pizza", "بيتزا الفرن"], cuisine: ["italian", "pizza"], zone: 1 },
        { name: ["Dubai Shawarma House", "بيت الشاورما"], cuisine: ["middle-eastern"], zone: 1 },
        { name: ["Kerala Kitchen", "مطبخ كيرالا"], cuisine: ["indian", "south-indian"], zone: 2 },
        { name: ["Sushi Harbor", "ميناء السوشي"], cuisine: ["japanese"], zone: 2 },
        { name: ["Green Bowl", "الوعاء الأخضر"], cuisine: ["healthy", "salads"], zone: 3 },
      ];

      for (let r = 0; r < restaurantSeeds.length; r++) {
        const rs = restaurantSeeds[r]!;
        const orgId = id(400 + r);
        const restaurantId = id(500 + r);
        const branchId = id(600 + r);
        const menuId = id(700 + r);

        await tx.insert(schema.merchantOrganizations).values({
          id: orgId, nameEn: rs.name[0]!, nameAr: rs.name[1]!,
          tradeLicenseNumber: `SEED-TL-${r + 1}`, status: "ACTIVE",
        }).onConflictDoNothing();

        await tx.insert(schema.restaurants).values({
          id: restaurantId, orgId, nameEn: rs.name[0]!, nameAr: rs.name[1]!,
          cuisineTypes: rs.cuisine, commissionRate: "0.2000", isActive: true,
        }).onConflictDoNothing();

        await tx.insert(schema.branches).values({
          id: branchId, restaurantId, zoneId: id(rs.zone), nameEn: `${rs.name[0]} Main`, nameAr: rs.name[1]!,
          addressLine1: "Seed address", location: { lat: 24.49, lng: 54.39 }, phone: `+9715550100${r}`,
        }).onConflictDoNothing();

        await tx.insert(schema.menus).values({
          id: menuId, branchId, nameEn: "Main menu", nameAr: "القائمة الرئيسية",
        }).onConflictDoNothing();

        const categories = [id(800 + r * 2), id(801 + r * 2)];
        await tx.insert(schema.menuCategories).values([
          { id: categories[0]!, menuId, nameEn: "Mains", nameAr: "الأطباق الرئيسية", sortOrder: 1 },
          { id: categories[1]!, menuId, nameEn: "Drinks", nameAr: "المشروبات", sortOrder: 2 },
        ]).onConflictDoNothing();

        for (let i = 0; i < 4; i++) {
          const itemId = id(1000 + r * 10 + i);
          const groupId = id(2000 + r * 10 + i);
          await tx.insert(schema.menuItems).values({
            id: itemId, categoryId: categories[i < 3 ? 0 : 1]!,
            nameEn: `Item ${i + 1}`, nameAr: `صنف ${i + 1}`,
            basePriceFils: 2500 + i * 500, sortOrder: i,
          }).onConflictDoNothing();
          await tx.insert(schema.modifierGroups).values({
            id: groupId, itemId, nameEn: "Size", nameAr: "الحجم",
            isRequired: true, minSelect: 1, maxSelect: 1,
          }).onConflictDoNothing();
          await tx.insert(schema.modifierOptions).values([
            { id: id(3000 + r * 100 + i * 10), groupId, nameEn: "Regular", nameAr: "عادي", priceAdjustmentFils: 0 },
            { id: id(3001 + r * 100 + i * 10), groupId, nameEn: "Large", nameAr: "كبير", priceAdjustmentFils: 500 },
          ]).onConflictDoNothing();
        }
      }
    });
    console.log("seed: ok");
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seed();
}

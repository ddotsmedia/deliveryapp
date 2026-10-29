import { eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { courierProfiles, customerProfiles } from "../db/schema/index.js";
import { forbidden } from "./errors.js";

export async function customerProfileId(db: Db, userId: string): Promise<string> {
  const [row] = await db.select({ id: customerProfiles.id }).from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
  if (!row) throw forbidden("A customer profile is required");
  return row.id;
}

export async function courierProfileId(db: Db, userId: string): Promise<string> {
  const [row] = await db.select({ id: courierProfiles.id }).from(courierProfiles).where(eq(courierProfiles.userId, userId)).limit(1);
  if (!row) throw forbidden("A courier profile is required");
  return row.id;
}

import { z } from "zod";

export const cartInput = z.object({
  branchId: z.uuid(),
  items: z
    .array(z.object({ menuItemId: z.uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(50),
});
export type CartInput = z.infer<typeof cartInput>;

export const quoteInput = z.object({ addressId: z.uuid() });
export type QuoteInput = z.infer<typeof quoteInput>;

export const placeOrderInput = z.object({
  quoteId: z.uuid(),
  specialInstructions: z.string().max(500).optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderInput>;

export const cartItemsSchema = z.array(z.object({ menuItemId: z.uuid(), quantity: z.number().int().min(1) }));

// Quote snapshot: prices and address frozen at quote time.
export const snapshotSchema = z.object({
  addressId: z.uuid(),
  lines: z.array(
    z.object({
      menuItemId: z.uuid(),
      nameEn: z.string(),
      nameAr: z.string(),
      unitPriceFils: z.number().int(),
      quantity: z.number().int(),
    }),
  ),
});

export const proofInput = z.object({
  photoUrl: z.url().max(2048),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const shiftInput = z.object({
  status: z.enum(["ONLINE", "OFFLINE"]),
  zoneId: z.uuid().optional(),
});

export const locationInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const rejectInput = z.object({ reason: z.string().max(200).optional() });

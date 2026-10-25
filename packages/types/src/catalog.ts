import { z } from "zod";
import { Fils } from "./common.js";

export const CurrencyCode = z.literal("AED");
export type CurrencyCode = z.infer<typeof CurrencyCode>;

export const Price = z.object({ amountFils: Fils, currency: CurrencyCode });
export type Price = z.infer<typeof Price>;

export const LocalizedText = z.object({ en: z.string().min(1), ar: z.string().min(1) });
export type LocalizedText = z.infer<typeof LocalizedText>;

export const Coordinates = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof Coordinates>;

export const Restaurant = z.object({
  id: z.uuid(),
  name: LocalizedText,
  description: LocalizedText.optional(),
  cuisineTypes: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Restaurant = z.infer<typeof Restaurant>;

export const Branch = z.object({
  id: z.uuid(),
  restaurantId: z.uuid(),
  zoneId: z.uuid(),
  name: LocalizedText,
  address: z.string().min(1),
  location: Coordinates,
  isActive: z.boolean(),
});
export type Branch = z.infer<typeof Branch>;

export const ModifierOption = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  name: LocalizedText,
  priceAdjustment: Price,
});
export type ModifierOption = z.infer<typeof ModifierOption>;

export const ModifierGroup = z.object({
  id: z.uuid(),
  itemId: z.uuid(),
  name: LocalizedText,
  required: z.boolean(),
  multiSelect: z.boolean(),
  minSelect: z.number().int().min(0),
  maxSelect: z.number().int().min(1),
});
export type ModifierGroup = z.infer<typeof ModifierGroup>;

export const MenuItem = z.object({
  id: z.uuid(),
  branchId: z.uuid(),
  name: LocalizedText,
  description: LocalizedText.optional(),
  basePrice: Price,
  isAvailable: z.boolean(),
  allergens: z.array(z.string()),
  imageUrl: z.url().optional(),
});
export type MenuItem = z.infer<typeof MenuItem>;

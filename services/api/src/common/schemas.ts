import { z } from "zod";

export const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone must be E.164");
export const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const idempotencyKey = z.string().min(8).max(128);
export const uuidParam = (value: string): string => z.uuid().parse(value);

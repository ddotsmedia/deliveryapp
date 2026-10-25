import { z } from "zod";

export const ShiftStatus = z.enum(["ONLINE", "OFFLINE", "BUSY"]);
export type ShiftStatus = z.infer<typeof ShiftStatus>;

export const DispatchOfferStatus = z.enum(["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"]);
export type DispatchOfferStatus = z.infer<typeof DispatchOfferStatus>;

export const DispatchOffer = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  courierId: z.uuid(),
  status: DispatchOfferStatus,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type DispatchOffer = z.infer<typeof DispatchOffer>;

export const Assignment = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  courierId: z.uuid(),
  offerId: z.uuid(),
  assignedAt: z.iso.datetime(),
});
export type Assignment = z.infer<typeof Assignment>;

export const ProofOfDelivery = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
  photoUrl: z.url(),
  signatureUrl: z.url().optional(),
  deliveredAt: z.iso.datetime(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type ProofOfDelivery = z.infer<typeof ProofOfDelivery>;

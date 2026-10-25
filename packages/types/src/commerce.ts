import { z } from "zod";
import { Fils } from "./common.js";

export const OrderStatus = z.enum([
  "PLACED", "PAYMENT_AUTHORIZED", "MERCHANT_PENDING", "ACCEPTED", "PREPARING",
  "READY", "PICKED_UP", "DELIVERED", "REJECTED", "CANCELLED", "FAILED", "REFUNDED",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const CartItem = z.object({
  itemId: z.uuid(),
  quantity: z.number().int().min(1).max(50),
  selectedOptions: z.array(z.object({
    groupId: z.uuid(),
    optionIds: z.array(z.uuid()),
  })),
});
export type CartItem = z.infer<typeof CartItem>;

export const Cart = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  branchId: z.uuid(),
  items: z.array(CartItem),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Cart = z.infer<typeof Cart>;

export const QuoteLineItem = z.object({
  itemId: z.uuid(),
  nameEn: z.string(),
  quantity: z.number().int().min(1),
  unitPriceFils: Fils,
  totalPriceFils: Fils,
});
export type QuoteLineItem = z.infer<typeof QuoteLineItem>;

export const Quote = z.object({
  id: z.uuid(),
  cartId: z.uuid(),
  branchId: z.uuid(),
  lines: z.array(QuoteLineItem),
  subtotalFils: Fils,
  deliveryFeeFils: Fils,
  serviceFeeFils: Fils,
  vatFils: Fils,
  tipFils: Fils,
  totalFils: Fils,
  expiresAt: z.iso.datetime(),
});
export type Quote = z.infer<typeof Quote>;

export const OrderEvent = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  status: OrderStatus,
  actorId: z.uuid().nullable(),
  actorRole: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type OrderEvent = z.infer<typeof OrderEvent>;

export const Order = z.object({
  id: z.uuid(),
  quoteId: z.uuid(),
  customerId: z.uuid(),
  branchId: z.uuid(),
  status: OrderStatus,
  addressId: z.uuid(),
  quote: Quote,
  createdAt: z.iso.datetime(),
});
export type Order = z.infer<typeof Order>;

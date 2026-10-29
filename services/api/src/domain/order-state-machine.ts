export const ORDER_STATUSES = [
  "PLACED", "PAYMENT_AUTHORIZED", "MERCHANT_PENDING", "ACCEPTED", "PREPARING",
  "READY", "PICKED_UP", "DELIVERED", "REJECTED", "CANCELLED", "FAILED", "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Single source of truth for legal order transitions.
export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["PAYMENT_AUTHORIZED", "FAILED", "CANCELLED"],
  PAYMENT_AUTHORIZED: ["MERCHANT_PENDING", "CANCELLED", "FAILED"],
  MERCHANT_PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "READY", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP"],
  PICKED_UP: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  REJECTED: [],
  CANCELLED: [],
  FAILED: [],
  REFUNDED: [],
};

export function allowedNext(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

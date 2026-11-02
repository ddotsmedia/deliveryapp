export const TEMPLATES = {
  ORDER_PLACED: { en: "Your order has been placed.", ar: "تم استلام طلبك." },
  ORDER_ACCEPTED: { en: "The restaurant accepted your order.", ar: "قام المطعم بقبول طلبك." },
  ORDER_READY: { en: "Your order is ready for pickup.", ar: "طلبك جاهز للاستلام." },
  ORDER_PICKED_UP: { en: "Your courier picked up your order.", ar: "استلم المندوب طلبك." },
  ORDER_DELIVERED: { en: "Your order has been delivered.", ar: "تم توصيل طلبك." },
  OFFER_RECEIVED: { en: "A new delivery offer is available.", ar: "يتوفر عرض توصيل جديد." },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

// Both languages are stored in the row so the API can render the user's language at read time.
export function renderBoth(name: TemplateName): { en: string; ar: string } {
  return { en: TEMPLATES[name].en, ar: TEMPLATES[name].ar };
}

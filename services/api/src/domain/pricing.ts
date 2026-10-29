// All amounts are integer fils (1 AED = 100 fils). Rounding is half-up on integers.
export const DELIVERY_FEE_FILS = 1000;
export const SERVICE_FEE_BPS = 500; // 5.00% of subtotal
export const VAT_BPS = 500; // 5.00% UAE VAT on (subtotal + fees)
export const QUOTE_TTL_MINUTES = 10;

// round(value * bps / 10000), half-up, integer math only.
export function applyBps(amountFils: number, bps: number): number {
  return Math.floor((amountFils * bps + 5000) / 10000);
}

export type QuoteInput = {
  lines: { unitPriceFils: number; quantity: number }[];
  deliveryFeeFils?: number;
  tipFils?: number;
};

export type QuoteTotals = {
  subtotalFils: number;
  deliveryFeeFils: number;
  serviceFeeFils: number;
  vatFils: number;
  tipFils: number;
  totalFils: number;
};

export function computeQuote(input: QuoteInput): QuoteTotals {
  const subtotalFils = input.lines.reduce((sum, l) => sum + l.unitPriceFils * l.quantity, 0);
  const deliveryFeeFils = input.deliveryFeeFils ?? DELIVERY_FEE_FILS;
  const serviceFeeFils = applyBps(subtotalFils, SERVICE_FEE_BPS);
  const taxableBase = subtotalFils + deliveryFeeFils + serviceFeeFils;
  const vatFils = applyBps(taxableBase, VAT_BPS);
  const tipFils = input.tipFils ?? 0;
  const totalFils = taxableBase + vatFils + tipFils;
  return { subtotalFils, deliveryFeeFils, serviceFeeFils, vatFils, tipFils, totalFils };
}

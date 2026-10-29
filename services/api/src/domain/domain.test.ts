import { describe, expect, it } from "vitest";
import { canTransition, allowedNext } from "./order-state-machine.js";
import { applyBps, computeQuote } from "./pricing.js";
import { signPayload, verifySignature } from "./webhook.js";
import { assertBalanced } from "./ledger.js";

describe("order state machine", () => {
  it("allows the happy path and rejects skips", () => {
    expect(canTransition("PLACED", "PAYMENT_AUTHORIZED")).toBe(true);
    expect(canTransition("READY", "PICKED_UP")).toBe(true);
    expect(canTransition("PICKED_UP", "DELIVERED")).toBe(true);
    expect(canTransition("READY", "DELIVERED")).toBe(false);
    expect(canTransition("MERCHANT_PENDING", "DELIVERED")).toBe(false);
  });

  it("terminal states have no outgoing transitions", () => {
    expect(allowedNext("REJECTED")).toEqual([]);
    expect(allowedNext("CANCELLED")).toEqual([]);
  });
});

describe("pricing", () => {
  it("applyBps rounds half-up on integers", () => {
    expect(applyBps(1, 5000)).toBe(1);
    expect(applyBps(3, 1000)).toBe(0);
    expect(applyBps(5, 1000)).toBe(1);
  });

  it("computes fees, VAT and total in fils", () => {
    const t = computeQuote({ lines: [{ unitPriceFils: 2500, quantity: 2 }] });
    expect(t.subtotalFils).toBe(5000);
    expect(t.serviceFeeFils).toBe(250);
    expect(t.deliveryFeeFils).toBe(1000);
    expect(t.vatFils).toBe(313);
    expect(t.totalFils).toBe(6563);
  });
});

describe("webhook signature", () => {
  const secret = "unit-test-secret-0123456789";
  const body = JSON.stringify({ id: "evt_1", type: "payment.failed" });

  it("accepts a correct signature and rejects tampering or absence", () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body, sig, secret)).toBe(true);
    expect(verifySignature(body + " ", sig, secret)).toBe(false);
    expect(verifySignature(body, undefined, secret)).toBe(false);
    expect(verifySignature(body, sig, "")).toBe(false);
  });
});

describe("ledger balance", () => {
  it("accepts balanced one-sided lines", () => {
    expect(() =>
      assertBalanced([
        { debitFils: 100, creditFils: 0 },
        { debitFils: 0, creditFils: 60 },
        { debitFils: 0, creditFils: 40 },
      ]),
    ).not.toThrow();
  });

  it("rejects unbalanced, two-sided and too-small posting sets", () => {
    expect(() => assertBalanced([{ debitFils: 100, creditFils: 0 }, { debitFils: 0, creditFils: 99 }])).toThrow(/LEDGER_UNBALANCED/);
    expect(() => assertBalanced([{ debitFils: 5, creditFils: 5 }, { debitFils: 0, creditFils: 0 }])).toThrow(/two-sided/);
    expect(() => assertBalanced([{ debitFils: 5, creditFils: 0 }])).toThrow(/at least two/);
  });
});

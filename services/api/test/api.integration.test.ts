import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { startTestApp, makeCall, randomE164, WEBHOOK_SECRET, type Call } from "./helpers.js";
import type { BuiltApp } from "../src/bootstrap.js";
import type { CaptureOtpSender } from "../src/infra/otp-sender.js";
import { branches, ledgerEntries, menuCategories, menuItems, menus, merchantStaff, quotes, restaurants, users } from "../src/db/schema/index.js";

// Seed phones (format +9715550000<index>): 0 customer, 1 merchant owner (org 400), 3 courier.
const PHONE = { customer: "+97155500000", owner: "+97155500001", courier: "+97155500003" };

let built: BuiltApp;
let otp: CaptureOtpSender;
let call: (m: "GET" | "POST" | "PUT" | "PATCH", url: string, o?: Parameters<ReturnType<typeof makeCall>>[2]) => Promise<Call>;
const tok: Record<"customer" | "owner" | "courier", string> = { customer: "", owner: "", courier: "" };
let addressId = "";
let branchId = "";
let zoneId = "";
let menuItemId = "";
let courierUserId = "";

type Tokens = { accessToken: string; refreshToken: string; user: { id: string; role: string } };
const json = <T>(c: Call): T => c.body as T;

async function login(phone: string): Promise<Tokens> {
  const r1 = await call("POST", "/v1/auth/otp/request", { body: { phone } });
  expect(r1.status).toBe(202);
  const code = otp.sent.get(phone);
  expect(code).toBeDefined();
  const r2 = await call("POST", "/v1/auth/otp/verify", { body: { phone, code } });
  expect(r2.status).toBe(200);
  return json<Tokens>(r2);
}

async function createPendingOrder(key: string): Promise<{ orderId: string; quoteId: string }> {
  const q = await call("POST", "/v1/quotes", { token: tok.customer, body: { addressId } });
  expect(q.status).toBe(201);
  const quoteId = json<{ quoteId: string }>(q).quoteId;
  const o = await call("POST", "/v1/orders", { token: tok.customer, body: { quoteId }, headers: { "idempotency-key": key } });
  expect(o.status).toBe(201);
  return { orderId: json<{ id: string }>(o).id, quoteId };
}

beforeAll(async () => {
  const started = await startTestApp();
  built = started.built;
  otp = started.otp;
  call = makeCall(built);
  const db = built.resources.db.db;

  for (const [role, phone] of Object.entries(PHONE) as [keyof typeof tok, string][]) {
    tok[role] = (await login(phone)).accessToken;
  }
  courierUserId = (await db.select({ id: users.id }).from(users).where(eq(users.phone, PHONE.courier)).limit(1))[0]!.id;

  // Branch and an available item belonging to the merchant's org (org 400).
  const [staff] = await db.select({ orgId: merchantStaff.orgId }).from(merchantStaff).where(eq(merchantStaff.userId, (await db.select({ id: users.id }).from(users).where(eq(users.phone, PHONE.owner)).limit(1))[0]!.id)).limit(1);
  const [br] = await db
    .select({ id: branches.id, zoneId: branches.zoneId })
    .from(branches)
    .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
    .where(eq(restaurants.orgId, staff!.orgId))
    .limit(1);
  branchId = br!.id;
  zoneId = br!.zoneId;
  const [item] = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .innerJoin(menus, eq(menus.id, menuCategories.menuId))
    .where(and(eq(menus.branchId, branchId), eq(menuItems.isAvailable, true)))
    .limit(1);
  menuItemId = item!.id;

  // Courier goes online in the branch zone before the order becomes READY.
  const c = await call("POST", "/v1/courier/shift", { token: tok.courier, body: { status: "ONLINE", zoneId } });
  expect(c.status).toBe(200);

  const a = await call("POST", "/v1/me/addresses", {
    token: tok.customer,
    body: { addressLine1: "Villa 12, Al Reem", location: { lat: 24.49, lng: 54.39 } },
  });
  expect(a.status).toBe(201);
  addressId = json<{ id: string }>(a).id;

  const cart = await call("PUT", "/v1/cart", { token: tok.customer, body: { branchId, items: [{ menuItemId, quantity: 2 }] } });
  expect(cart.status).toBe(200);
}, 60_000);

afterAll(async () => {
  await built?.close();
});

describe("auth", () => {
  it("returns problem+json on a missing token", async () => {
    const r = await call("GET", "/v1/me");
    expect(r.status).toBe(401);
    expect(r.contentType).toContain("application/problem+json");
  });

  it("rate-limits OTP requests: sixth in a minute is 429", async () => {
    const phone = randomE164();
    for (let i = 0; i < 5; i++) {
      expect((await call("POST", "/v1/auth/otp/request", { body: { phone } })).status).toBe(202);
    }
    expect((await call("POST", "/v1/auth/otp/request", { body: { phone } })).status).toBe(429);
  });

  it("rotates refresh tokens and revokes all sessions on reuse", async () => {
    const t1 = await login(randomE164());
    const r2 = await call("POST", "/v1/auth/refresh", { body: { refreshToken: t1.refreshToken } });
    expect(r2.status).toBe(200);
    const t2 = json<Tokens>(r2);

    const reuse = await call("POST", "/v1/auth/refresh", { body: { refreshToken: t1.refreshToken } });
    expect(reuse.status).toBe(401);
    expect((reuse.body as { code: string }).code).toBe("REFRESH_REUSED");

    const after = await call("POST", "/v1/auth/refresh", { body: { refreshToken: t2.refreshToken } });
    expect(after.status).toBe(401);
  });
});

describe("order flow", () => {
  const KEY = `key-${Date.now()}-happy`;
  let orderId = "";

  it("rejects order placement without Idempotency-Key", async () => {
    const q = await call("POST", "/v1/quotes", { token: tok.customer, body: { addressId } });
    const r = await call("POST", "/v1/orders", { token: tok.customer, body: { quoteId: json<{ quoteId: string }>(q).quoteId } });
    expect(r.status).toBe(400);
  });

  it("places an order, replays the same response on a duplicate key", async () => {
    const q = await call("POST", "/v1/quotes", { token: tok.customer, body: { addressId } });
    expect(q.status).toBe(201);
    const quote = json<{ quoteId: string; totals: { totalFils: number } }>(q);
    expect(quote.totals.totalFils).toBeGreaterThan(0);

    const first = await call("POST", "/v1/orders", { token: tok.customer, body: { quoteId: quote.quoteId }, headers: { "idempotency-key": KEY } });
    expect(first.status).toBe(201);
    expect(json<{ status: string }>(first).status).toBe("MERCHANT_PENDING");
    orderId = json<{ id: string }>(first).id;

    const replay = await call("POST", "/v1/orders", { token: tok.customer, body: { quoteId: quote.quoteId }, headers: { "idempotency-key": KEY } });
    expect(replay.status).toBe(200);
    expect(json<{ id: string }>(replay).id).toBe(orderId);
  });

  it("drives the order to DELIVERED with a balanced ledger", async () => {
    expect((await call("POST", `/v1/merchant/orders/${orderId}/accept`, { token: tok.owner })).status).toBe(200);
    const ready = await call("POST", `/v1/merchant/orders/${orderId}/ready`, { token: tok.owner });
    expect(ready.status).toBe(200);
    expect(json<{ status: string }>(ready).status).toBe("READY");

    const offers = json<{ id: string; orderId: string }[]>(await call("GET", "/v1/courier/offers", { token: tok.courier }));
    const mine = offers.find((o) => o.orderId === orderId);
    expect(mine).toBeDefined();
    expect((await call("POST", `/v1/courier/offers/${mine!.id}/accept`, { token: tok.courier })).status).toBe(200);

    expect((await call("POST", `/v1/courier/orders/${orderId}/pickup`, { token: tok.courier })).status).toBe(200);
    const done = await call("POST", `/v1/courier/orders/${orderId}/deliver`, {
      token: tok.courier,
      body: { photoUrl: "https://cdn.example.ae/pod/1.jpg", latitude: 24.49, longitude: 54.39 },
    });
    expect(done.status).toBe(200);
    expect(json<{ status: string }>(done).status).toBe("DELIVERED");

    const db = built.resources.db.db;
    const rows = await db.select().from(ledgerEntries).where(and(eq(ledgerEntries.referenceType, "ORDER"), eq(ledgerEntries.referenceId, orderId)));
    const debit = rows.reduce((s, r) => s + r.debitFils, 0);
    const credit = rows.reduce((s, r) => s + r.creditFils, 0);
    expect(debit).toBeGreaterThan(0);
    expect(debit).toBe(credit);
  });

  it("returns 422 for an invalid transition on a delivered order", async () => {
    const r = await call("POST", `/v1/merchant/orders/${orderId}/accept`, { token: tok.owner });
    expect(r.status).toBe(422);
    expect((r.body as { code: string }).code).toBe("INVALID_TRANSITION");
  });
});

describe("quotes and concurrency", () => {
  it("returns 409 when placing an order from an expired quote", async () => {
    const q = await call("POST", "/v1/quotes", { token: tok.customer, body: { addressId } });
    const quoteId = json<{ quoteId: string }>(q).quoteId;
    await built.resources.db.db.update(quotes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(quotes.id, quoteId));
    const r = await call("POST", "/v1/orders", { token: tok.customer, body: { quoteId }, headers: { "idempotency-key": `key-${Date.now()}-exp` } });
    expect(r.status).toBe(409);
    expect((r.body as { code: string }).code).toBe("QUOTE_EXPIRED");
  });

  it("two concurrent accepts: one 200, one 409", async () => {
    const { orderId } = await createPendingOrder(`key-${Date.now()}-race`);
    const results = await Promise.all([
      call("POST", `/v1/merchant/orders/${orderId}/accept`, { token: tok.owner }),
      call("POST", `/v1/merchant/orders/${orderId}/accept`, { token: tok.owner }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});

describe("payment webhook", () => {
  it("rejects a bad signature and ignores duplicate event ids", async () => {
    const body = { id: `evt_${Date.now()}`, type: "payment.failed", providerIntentId: "mock_none" };
    const raw = JSON.stringify(body);
    const bad = await call("POST", "/v1/webhooks/payments", { raw, headers: { "x-webhook-signature": "00".repeat(32) } });
    expect(bad.status).toBe(401);

    const sig = createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
    const first = await call("POST", "/v1/webhooks/payments", { raw, headers: { "x-webhook-signature": sig } });
    expect(first.status).toBe(200);
    expect((first.body as { duplicate: boolean }).duplicate).toBe(false);

    const again = await call("POST", "/v1/webhooks/payments", { raw, headers: { "x-webhook-signature": sig } });
    expect((again.body as { duplicate: boolean }).duplicate).toBe(true);
  });
});

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { AuthUser } from "../../common/auth.js";
import { AppError, conflict, forbidden, notFound } from "../../common/errors.js";
import { courierProfileId, customerProfileId } from "../../common/profiles.js";
import type { DbHandle } from "../../infra/db.js";
import type { PaymentAdapter } from "../../infra/payment-adapter.js";
import { isUniqueViolation } from "../../db/errors.js";
import {
  assignments,
  branches,
  carts,
  customerAddresses,
  merchantStaff,
  menuCategories,
  menuItems,
  menus,
  orderEvents,
  orders,
  paymentIntents,
  quotes,
  restaurants,
} from "../../db/schema/index.js";
import { computeQuote, QUOTE_TTL_MINUTES } from "../../domain/pricing.js";
import { DB, PAYMENT_ADAPTER } from "../../tokens.js";
import { transitionOrder } from "./transitions.js";
import type { CartInput, PlaceOrderInput, QuoteInput } from "./schemas.js";
import { cartItemsSchema, snapshotSchema } from "./schemas.js";

export type PricedLine = {
  menuItemId: string;
  nameEn: string;
  nameAr: string;
  unitPriceFils: number;
  quantity: number;
};

@Injectable()
export class CommerceService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(PAYMENT_ADAPTER) private readonly payment: PaymentAdapter,
  ) {}

  private get db() {
    return this.handle.db;
  }

  // Prices come from the database, never from the client. Rejects items outside the branch or unavailable.
  async pricedLines(branchId: string, items: { menuItemId: string; quantity: number }[]): Promise<PricedLine[]> {
    const rows = await this.db
      .select({
        id: menuItems.id,
        nameEn: menuItems.nameEn,
        nameAr: menuItems.nameAr,
        price: menuItems.basePriceFils,
        available: menuItems.isAvailable,
        branchId: menus.branchId,
      })
      .from(menuItems)
      .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
      .innerJoin(menus, eq(menus.id, menuCategories.menuId))
      .where(inArray(menuItems.id, items.map((i) => i.menuItemId)));
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    return items.map((i) => {
      const r = byId.get(i.menuItemId);
      if (!r || r.branchId !== branchId) throw new AppError(422, "ITEM_NOT_IN_BRANCH", "Item does not belong to this branch");
      if (!r.available) throw conflict("ITEM_UNAVAILABLE", `${r.nameEn} is unavailable`);
      return { menuItemId: r.id, nameEn: r.nameEn, nameAr: r.nameAr, unitPriceFils: r.price, quantity: i.quantity };
    });
  }

  async putCart(userId: string, input: CartInput) {
    const customerId = await customerProfileId(this.db, userId);
    const [branch] = await this.db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.isActive, true)))
      .limit(1);
    if (!branch) throw notFound("Branch");
    await this.pricedLines(branch.id, input.items); // validates items; result discarded

    const [existing] = await this.db.select({ id: carts.id }).from(carts).where(eq(carts.customerId, customerId)).limit(1);
    if (existing) {
      await this.db.update(carts).set({ branchId: branch.id, items: input.items, updatedAt: new Date() }).where(eq(carts.id, existing.id));
    } else {
      await this.db.insert(carts).values({ customerId, branchId: branch.id, items: input.items });
    }
    return this.getCart(userId);
  }

  async getCart(userId: string) {
    const customerId = await customerProfileId(this.db, userId);
    const [cart] = await this.db.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);
    if (!cart) return null;
    const items = cartItemsSchema.parse(cart.items);
    const lines = await this.pricedLines(cart.branchId, items);
    const subtotalFils = lines.reduce((sum, l) => sum + l.unitPriceFils * l.quantity, 0);
    return { cartId: cart.id, branchId: cart.branchId, lines, subtotalFils };
  }

  async createQuote(userId: string, input: QuoteInput) {
    const customerId = await customerProfileId(this.db, userId);
    const cart = await this.getCart(userId);
    if (!cart || cart.lines.length === 0) throw new AppError(422, "CART_EMPTY", "Cart is empty");
    const [branch] = await this.db.select({ zoneId: branches.zoneId }).from(branches).where(eq(branches.id, cart.branchId)).limit(1);
    if (!branch) throw notFound("Branch");
    const [address] = await this.db
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, input.addressId), eq(customerAddresses.customerId, customerId)))
      .limit(1);
    if (!address) throw notFound("Address");

    const totals = computeQuote({ lines: cart.lines.map((l) => ({ unitPriceFils: l.unitPriceFils, quantity: l.quantity })) });
    const [quote] = await this.db
      .insert(quotes)
      .values({
        cartId: cart.cartId,
        customerId,
        branchId: cart.branchId,
        zoneId: branch.zoneId,
        subtotalFils: totals.subtotalFils,
        deliveryFeeFils: totals.deliveryFeeFils,
        serviceFeeFils: totals.serviceFeeFils,
        vatFils: totals.vatFils,
        tipFils: totals.tipFils,
        totalFils: totals.totalFils,
        expiresAt: new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000),
        snapshot: { addressId: address.id, lines: cart.lines },
      })
      .returning();
    if (!quote) throw new Error("quote insert returned no row");
    return { quoteId: quote.id, expiresAt: quote.expiresAt, lines: cart.lines, totals };
  }

  private async findByKey(key: string) {
    const [row] = await this.db
      .select({ id: orders.id, customerId: orders.customerId, status: orders.status })
      .from(orders)
      .where(eq(orders.idempotencyKey, key))
      .limit(1);
    return row;
  }

  // Duplicate Idempotency-Key: return the original order. Resume payment if it never got past PLACED.
  private async replay(order: { id: string; customerId: string }, customerId: string) {
    if (order.customerId !== customerId) throw conflict("IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was used by another request");
    await this.completePayment(order.id);
    return { created: false, order: await this.orderView(order.id) };
  }

  async placeOrder(userId: string, key: string, input: PlaceOrderInput) {
    const customerId = await customerProfileId(this.db, userId);
    const existing = await this.findByKey(key);
    if (existing) return this.replay(existing, customerId);

    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, input.quoteId), eq(quotes.customerId, customerId)))
      .limit(1);
    if (!quote) throw notFound("Quote");
    if (quote.expiresAt.getTime() <= Date.now()) throw conflict("QUOTE_EXPIRED", "Quote has expired; request a new quote");
    const snap = snapshotSchema.parse(quote.snapshot);

    let orderId: string;
    try {
      orderId = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(orders)
          .values({
            quoteId: quote.id,
            customerId,
            branchId: quote.branchId,
            zoneId: quote.zoneId,
            addressId: snap.addressId,
            specialInstructions: input.specialInstructions ?? null,
            idempotencyKey: key,
          })
          .returning({ id: orders.id });
        if (!row) throw new Error("order insert returned no row");
        await tx.insert(orderEvents).values({ orderId: row.id, status: "PLACED", actorId: userId, actorRole: "CUSTOMER" });
        return row.id;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Lost a race: either a concurrent duplicate of this key, or the quote was already used by another order.
      const winner = await this.findByKey(key);
      if (winner) return this.replay(winner, customerId);
      throw conflict("QUOTE_USED", "This quote already has an order");
    }

    await this.completePayment(orderId);
    return { created: true, order: await this.orderView(orderId) };
  }

  private async completePayment(orderId: string): Promise<void> {
    const [row] = await this.db
      .select({ status: orders.status, key: orders.idempotencyKey, total: quotes.totalFils })
      .from(orders)
      .innerJoin(quotes, eq(quotes.id, orders.quoteId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!row || row.status !== "PLACED") return;

    const auth = await this.payment.authorize({ orderId, amountFils: row.total, idempotencyKey: row.key });
    await this.db.transaction(async (tx) => {
      await tx.insert(paymentIntents).values({
        orderId,
        provider: this.payment.name,
        providerIntentId: auth.providerIntentId,
        status: "AUTHORIZED",
        amountFils: row.total,
        idempotencyKey: row.key,
      });
      await transitionOrder(tx, { orderId, to: "PAYMENT_AUTHORIZED", actorRole: "SYSTEM" });
      await transitionOrder(tx, { orderId, to: "MERCHANT_PENDING", actorRole: "SYSTEM" });
    });
  }

  async orderView(orderId: string) {
    const [o] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!o) throw notFound("Order");
    const [q] = await this.db.select().from(quotes).where(eq(quotes.id, o.quoteId)).limit(1);
    if (!q) throw new Error("order has no quote");
    const events = await this.db
      .select({ status: orderEvents.status, at: orderEvents.createdAt })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(asc(orderEvents.createdAt));
    const snap = snapshotSchema.parse(q.snapshot);
    return {
      id: o.id,
      status: o.status,
      version: o.version,
      branchId: o.branchId,
      zoneId: o.zoneId,
      specialInstructions: o.specialInstructions,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      lines: snap.lines,
      totals: {
        subtotalFils: q.subtotalFils,
        deliveryFeeFils: q.deliveryFeeFils,
        serviceFeeFils: q.serviceFeeFils,
        vatFils: q.vatFils,
        tipFils: q.tipFils,
        totalFils: q.totalFils,
      },
      events,
    };
  }

  async listOrders(userId: string) {
    const customerId = await customerProfileId(this.db, userId);
    return this.db
      .select({ id: orders.id, status: orders.status, createdAt: orders.createdAt, totalFils: quotes.totalFils })
      .from(orders)
      .innerJoin(quotes, eq(quotes.id, orders.quoteId))
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(50);
  }

  async orgIdForOrder(orderId: string): Promise<string> {
    const [row] = await this.db
      .select({ orgId: restaurants.orgId })
      .from(orders)
      .innerJoin(branches, eq(branches.id, orders.branchId))
      .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!row) throw notFound("Order");
    return row.orgId;
  }

  async assertCanView(user: AuthUser, orderId: string): Promise<void> {
    switch (user.role) {
      case "SUPER_ADMIN":
      case "SUPPORT":
      case "FINANCE":
      case "DISPATCHER":
        return;
      case "CUSTOMER": {
        const customerId = await customerProfileId(this.db, user.id);
        const [o] = await this.db
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
          .limit(1);
        if (!o) throw notFound("Order");
        return;
      }
      case "MERCHANT_OWNER":
      case "MERCHANT_STAFF": {
        const orgId = await this.orgIdForOrder(orderId);
        const [s] = await this.db
          .select({ id: merchantStaff.id })
          .from(merchantStaff)
          .where(and(eq(merchantStaff.userId, user.id), eq(merchantStaff.orgId, orgId)))
          .limit(1);
        if (!s) throw forbidden("Not staff of this restaurant");
        return;
      }
      case "COURIER": {
        const courierId = await courierProfileId(this.db, user.id);
        const [a] = await this.db
          .select({ id: assignments.id })
          .from(assignments)
          .where(and(eq(assignments.orderId, orderId), eq(assignments.courierId, courierId)))
          .limit(1);
        if (!a) throw forbidden("Order is not assigned to you");
        return;
      }
      default:
        throw forbidden();
    }
  }

  async getOrder(user: AuthUser, orderId: string) {
    await this.assertCanView(user, orderId);
    return this.orderView(orderId);
  }
}


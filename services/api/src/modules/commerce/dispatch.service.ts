import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { and, eq, gt, isNull } from "drizzle-orm";
import { AppError, conflict, forbidden, notFound } from "../../common/errors.js";
import { courierProfileId } from "../../common/profiles.js";
import type { DbHandle } from "../../infra/db.js";
import type { Tx } from "../../db/tx.js";
import { assignments, courierShifts, dispatchOffers, orders, outboxMessages, proofOfDelivery } from "../../db/schema/index.js";
import { DB, REDIS } from "../../tokens.js";
import { transitionOrder } from "./transitions.js";
import { LedgerService } from "./ledger.service.js";
import { CommerceService } from "./commerce.service.js";

export const OFFER_TTL_SECONDS = 20;
const LOCATION_TTL_SECONDS = 90;

@Injectable()
export class DispatchService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(CommerceService) private readonly commerce: CommerceService,
  ) {}

  private get db() {
    return this.handle.db;
  }

  // Called inside the READY transaction: one open offer per online courier in the order's zone.
  async createOffers(tx: Tx, orderId: string): Promise<number> {
    const [order] = await tx.select({ zoneId: orders.zoneId }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw notFound("Order");
    const online = await tx
      .selectDistinct({ courierId: courierShifts.courierId })
      .from(courierShifts)
      .where(and(eq(courierShifts.zoneId, order.zoneId), eq(courierShifts.status, "ONLINE"), isNull(courierShifts.endedAt)));
    if (online.length === 0) return 0;
    const expiresAt = new Date(Date.now() + OFFER_TTL_SECONDS * 1000);
    await tx.insert(dispatchOffers).values(
      online.map((c) => ({ orderId, courierId: c.courierId, zoneId: order.zoneId, expiresAt })),
    );
    await tx.insert(outboxMessages).values({ topic: "dispatch.offers_created", payload: { orderId, count: online.length } });
    return online.length;
  }

  async setShift(userId: string, status: "ONLINE" | "OFFLINE", zoneId?: string) {
    const courierId = await courierProfileId(this.db, userId);
    if (status === "ONLINE" && !zoneId) throw new AppError(422, "ZONE_REQUIRED", "zoneId is required to go online");
    await this.db.transaction(async (tx) => {
      await tx
        .update(courierShifts)
        .set({ status: "OFFLINE", endedAt: new Date() })
        .where(and(eq(courierShifts.courierId, courierId), isNull(courierShifts.endedAt)));
      if (status === "ONLINE" && zoneId) {
        await tx.insert(courierShifts).values({ courierId, zoneId, status: "ONLINE" });
      }
    });
    return { status };
  }

  async setLocation(userId: string, lat: number, lng: number) {
    const courierId = await courierProfileId(this.db, userId);
    await this.redis.set(`courier:loc:${courierId}`, JSON.stringify({ lat, lng, at: Date.now() }), "EX", LOCATION_TTL_SECONDS);
    return { ok: true };
  }

  async listOffers(userId: string) {
    const courierId = await courierProfileId(this.db, userId);
    return this.db
      .select({ id: dispatchOffers.id, orderId: dispatchOffers.orderId, zoneId: dispatchOffers.zoneId, expiresAt: dispatchOffers.expiresAt })
      .from(dispatchOffers)
      .where(and(eq(dispatchOffers.courierId, courierId), eq(dispatchOffers.status, "PENDING"), gt(dispatchOffers.expiresAt, new Date())));
  }

  async acceptOffer(userId: string, offerId: string) {
    const courierId = await courierProfileId(this.db, userId);
    return this.db.transaction(async (tx) => {
      const [offer] = await tx
        .select()
        .from(dispatchOffers)
        .where(and(eq(dispatchOffers.id, offerId), eq(dispatchOffers.courierId, courierId)))
        .limit(1);
      if (!offer) throw notFound("Offer");
      const now = new Date();
      // Insert the assignment first: unique(order_id) arbitrates two couriers, and taking that lock
      // before touching any offer row avoids a lock-order deadlock between the two accepts.
      const [assignment] = await tx
        .insert(assignments)
        .values({ orderId: offer.orderId, courierId, offerId: offer.id, zoneId: offer.zoneId })
        .returning();
      // Conditional claim: only a still-PENDING, unexpired offer can be accepted.
      const [claimed] = await tx
        .update(dispatchOffers)
        .set({ status: "ACCEPTED", respondedAt: now })
        .where(and(eq(dispatchOffers.id, offer.id), eq(dispatchOffers.status, "PENDING"), gt(dispatchOffers.expiresAt, now)))
        .returning({ id: dispatchOffers.id });
      if (!claimed) throw conflict("OFFER_UNAVAILABLE", "Offer is no longer available");
      await tx
        .update(dispatchOffers)
        .set({ status: "REJECTED", respondedAt: now })
        .where(and(eq(dispatchOffers.orderId, offer.orderId), eq(dispatchOffers.status, "PENDING")));
      return assignment;
    });
  }

  private async assignmentFor(tx: Tx, courierId: string, orderId: string) {
    const [a] = await tx
      .select()
      .from(assignments)
      .where(and(eq(assignments.orderId, orderId), eq(assignments.courierId, courierId)))
      .limit(1);
    if (!a) throw forbidden("Order is not assigned to you");
    return a;
  }

  async pickup(userId: string, orderId: string) {
    const courierId = await courierProfileId(this.db, userId);
    await this.db.transaction(async (tx) => {
      const a = await this.assignmentFor(tx, courierId, orderId);
      await transitionOrder(tx, { orderId, to: "PICKED_UP", actorId: userId, actorRole: "COURIER" });
      await tx.update(assignments).set({ pickedUpAt: new Date() }).where(eq(assignments.id, a.id));
    });
    return this.commerce.orderView(orderId);
  }

  async deliver(userId: string, orderId: string, proof: { photoUrl: string; latitude: number; longitude: number }) {
    const courierId = await courierProfileId(this.db, userId);
    await this.db.transaction(async (tx) => {
      const a = await this.assignmentFor(tx, courierId, orderId);
      const now = new Date();
      await transitionOrder(tx, { orderId, to: "DELIVERED", actorId: userId, actorRole: "COURIER" });
      await tx.update(assignments).set({ deliveredAt: now }).where(eq(assignments.id, a.id));
      await tx.insert(proofOfDelivery).values({
        assignmentId: a.id,
        photoUrl: proof.photoUrl,
        deliveredAt: now,
        latitude: String(proof.latitude),
        longitude: String(proof.longitude),
      });
      await this.ledger.postDelivery(tx, orderId, courierId);
    });
    return this.commerce.orderView(orderId);
  }
}

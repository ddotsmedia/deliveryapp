import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { forbidden } from "../../common/errors.js";
import type { DbHandle } from "../../infra/db.js";
import type { PaymentAdapter } from "../../infra/payment-adapter.js";
import { merchantStaff, paymentIntents } from "../../db/schema/index.js";
import { DB, PAYMENT_ADAPTER } from "../../tokens.js";
import { CommerceService } from "./commerce.service.js";
import { DispatchService } from "./dispatch.service.js";
import { transitionOrder } from "./transitions.js";
import type { OrderStatus } from "../../domain/order-state-machine.js";

export type MerchantAction = "accept" | "reject" | "preparing" | "ready";
const TARGET: Record<MerchantAction, OrderStatus> = {
  accept: "ACCEPTED",
  reject: "REJECTED",
  preparing: "PREPARING",
  ready: "READY",
};

@Injectable()
export class MerchantService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(PAYMENT_ADAPTER) private readonly payment: PaymentAdapter,
    @Inject(CommerceService) private readonly commerce: CommerceService,
    @Inject(DispatchService) private readonly dispatch: DispatchService,
  ) {}

  private get db() {
    return this.handle.db;
  }

  private async assertStaff(userId: string, orderId: string): Promise<void> {
    const orgId = await this.commerce.orgIdForOrder(orderId);
    const [s] = await this.db
      .select({ id: merchantStaff.id })
      .from(merchantStaff)
      .where(and(eq(merchantStaff.userId, userId), eq(merchantStaff.orgId, orgId)))
      .limit(1);
    if (!s) throw forbidden("Not staff of this restaurant");
  }

  async decide(userId: string, orderId: string, action: MerchantAction, reason?: string) {
    await this.assertStaff(userId, orderId);
    const to = TARGET[action];
    const meta = reason ? { reason } : {};

    if (action === "ready") {
      // READY and the courier offers commit together, so no order is READY without an offer round.
      await this.db.transaction(async (tx) => {
        await transitionOrder(tx, { orderId, to, actorId: userId, actorRole: "MERCHANT" });
        await this.dispatch.createOffers(tx, orderId);
      });
    } else {
      await this.db.transaction(async (tx) => {
        await transitionOrder(tx, { orderId, to, actorId: userId, actorRole: "MERCHANT", metadata: meta });
      });
    }
    if (action === "reject") await this.voidPayment(orderId);
    return this.commerce.orderView(orderId);
  }

  private async voidPayment(orderId: string): Promise<void> {
    const [pi] = await this.db
      .select({ id: paymentIntents.id, providerIntentId: paymentIntents.providerIntentId })
      .from(paymentIntents)
      .where(eq(paymentIntents.orderId, orderId))
      .limit(1);
    if (!pi || !pi.providerIntentId) return;
    await this.payment.voidAuthorization(pi.providerIntentId);
    await this.db.update(paymentIntents).set({ status: "FAILED", updatedAt: new Date() }).where(eq(paymentIntents.id, pi.id));
  }
}


import { Controller, Headers, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { RawRequest } from "../../common/http.js";
import { z } from "zod";
import type { AppConfig } from "../../config.js";
import { Public } from "../../common/auth.js";
import { unauthorized } from "../../common/errors.js";
import { parse } from "../../common/validate.js";
import type { DbHandle } from "../../infra/db.js";
import type { PaymentAdapter } from "../../infra/payment-adapter.js";
import { verifySignature } from "../../domain/webhook.js";
import { paymentIntents, processedWebhookEvents } from "../../db/schema/index.js";
import { CONFIG, DB, PAYMENT_ADAPTER } from "../../tokens.js";

const webhookEvent = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["payment.authorized", "payment.failed"]),
  providerIntentId: z.string().min(1).max(100),
});

@Controller("v1/webhooks")
export class PaymentsController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(PAYMENT_ADAPTER) private readonly payment: PaymentAdapter,
  ) {}

  // HMAC-SHA256 over the raw body; duplicates are ignored via processed_webhook_events.
  @Public()
  @Post("payments")
  @HttpCode(200)
  async handleEvent(@Req() req: RawRequest, @Headers("x-webhook-signature") signature?: string) {
    const raw = req.rawBody ?? "";
    if (!verifySignature(raw, signature, this.config.CHECKOUT_WEBHOOK_SECRET)) throw unauthorized("Invalid webhook signature");
    const event = parse(webhookEvent, req.body);

    return this.handle.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(processedWebhookEvents)
        .values({ eventId: event.id, provider: this.payment.name })
        .onConflictDoNothing()
        .returning({ eventId: processedWebhookEvents.eventId });
      if (inserted.length === 0) return { received: true, duplicate: true };

      if (event.type === "payment.failed") {
        await tx
          .update(paymentIntents)
          .set({ status: "FAILED", updatedAt: new Date() })
          .where(eq(paymentIntents.providerIntentId, event.providerIntentId));
      }
      return { received: true, duplicate: false };
    });
  }
}

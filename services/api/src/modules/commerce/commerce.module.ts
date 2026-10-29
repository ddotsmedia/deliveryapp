import { Module } from "@nestjs/common";
import { CartOrderController } from "./cart-order.controller.js";
import { CommerceService } from "./commerce.service.js";
import { CourierController } from "./courier.controller.js";
import { DispatchService } from "./dispatch.service.js";
import { LedgerService } from "./ledger.service.js";
import { MerchantController } from "./merchant.controller.js";
import { MerchantService } from "./merchant.service.js";
import { PaymentsController } from "./payments.controller.js";

@Module({
  controllers: [CartOrderController, MerchantController, CourierController, PaymentsController],
  providers: [CommerceService, MerchantService, DispatchService, LedgerService],
  exports: [CommerceService],
})
export class CommerceModule {}

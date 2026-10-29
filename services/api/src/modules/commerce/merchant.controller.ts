import { Body, Controller, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { CurrentUser, Roles, type AuthUser } from "../../common/auth.js";
import { uuidParam } from "../../common/schemas.js";
import { parse } from "../../common/validate.js";
import { MerchantService } from "./merchant.service.js";
import { rejectInput } from "./schemas.js";

@Roles("MERCHANT_OWNER", "MERCHANT_STAFF")
@Controller("v1/merchant/orders")
export class MerchantController {
  constructor(@Inject(MerchantService) private readonly merchant: MerchantService) {}

  @Post(":id/accept")
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.merchant.decide(user.id, uuidParam(id), "accept");
  }

  @Post(":id/reject")
  @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    const { reason } = parse(rejectInput, body ?? {});
    return this.merchant.decide(user.id, uuidParam(id), "reject", reason);
  }

  @Post(":id/preparing")
  @HttpCode(200)
  preparing(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.merchant.decide(user.id, uuidParam(id), "preparing");
  }

  @Post(":id/ready")
  @HttpCode(200)
  ready(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.merchant.decide(user.id, uuidParam(id), "ready");
  }
}

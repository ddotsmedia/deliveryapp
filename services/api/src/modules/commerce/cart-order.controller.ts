import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Put, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { CurrentUser, Roles, type AuthUser } from "../../common/auth.js";
import { AppError } from "../../common/errors.js";
import { idempotencyKey, uuidParam } from "../../common/schemas.js";
import { parse } from "../../common/validate.js";
import { CommerceService } from "./commerce.service.js";
import { cartInput, placeOrderInput, quoteInput } from "./schemas.js";

@Controller("v1")
export class CartOrderController {
  constructor(@Inject(CommerceService) private readonly commerce: CommerceService) {}

  @Roles("CUSTOMER")
  @Get("cart")
  getCart(@CurrentUser() user: AuthUser) {
    return this.commerce.getCart(user.id);
  }

  @Roles("CUSTOMER")
  @Put("cart")
  putCart(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.commerce.putCart(user.id, parse(cartInput, body));
  }

  @Roles("CUSTOMER")
  @Post("quotes")
  @HttpCode(201)
  createQuote(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.commerce.createQuote(user.id, parse(quoteInput, body));
  }

  @Roles("CUSTOMER")
  @Post("orders")
  async placeOrder(
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    if (!key) throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
    const k = parse(idempotencyKey, key);
    const result = await this.commerce.placeOrder(user.id, k, parse(placeOrderInput, body));
    res.code(result.created ? 201 : 200);
    return result.order;
  }

  @Roles("CUSTOMER")
  @Get("orders")
  listOrders(@CurrentUser() user: AuthUser) {
    return this.commerce.listOrders(user.id);
  }

  @Get("orders/:id")
  getOrder(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.commerce.getOrder(user, uuidParam(id));
  }
}

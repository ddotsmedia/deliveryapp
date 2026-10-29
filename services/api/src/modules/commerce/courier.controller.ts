import { Body, Controller, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { CurrentUser, Roles, type AuthUser } from "../../common/auth.js";
import { uuidParam } from "../../common/schemas.js";
import { parse } from "../../common/validate.js";
import { DispatchService } from "./dispatch.service.js";
import { locationInput, proofInput, shiftInput } from "./schemas.js";

@Roles("COURIER")
@Controller("v1/courier")
export class CourierController {
  constructor(@Inject(DispatchService) private readonly dispatch: DispatchService) {}

  @Post("shift")
  @HttpCode(200)
  setShift(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = parse(shiftInput, body);
    return this.dispatch.setShift(user.id, input.status, input.zoneId);
  }

  @Post("location")
  @HttpCode(200)
  setLocation(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = parse(locationInput, body);
    return this.dispatch.setLocation(user.id, input.lat, input.lng);
  }

  @Get("offers")
  listOffers(@CurrentUser() user: AuthUser) {
    return this.dispatch.listOffers(user.id);
  }

  @Post("offers/:id/accept")
  @HttpCode(200)
  acceptOffer(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.dispatch.acceptOffer(user.id, uuidParam(id));
  }

  @Post("orders/:id/pickup")
  @HttpCode(200)
  pickup(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.dispatch.pickup(user.id, uuidParam(id));
  }

  @Post("orders/:id/deliver")
  @HttpCode(200)
  deliver(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.dispatch.deliver(user.id, uuidParam(id), parse(proofInput, body));
  }
}

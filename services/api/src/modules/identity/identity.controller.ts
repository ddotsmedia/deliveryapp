import { Body, Controller, Get, HttpCode, Inject, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, Public, Roles, type AuthUser } from "../../common/auth.js";
import { latLng, phone } from "../../common/schemas.js";
import { parse } from "../../common/validate.js";
import { IdentityService } from "./identity.service.js";

const otpRequest = z.object({ phone });
const otpVerify = z.object({ phone, code: z.string().regex(/^\d{6}$/) });
const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });
const profilePatch = z.object({
  nameFirst: z.string().min(1).max(100).optional(),
  nameLast: z.string().min(1).max(100).optional(),
  preferredLanguage: z.enum(["en", "ar"]).optional(),
});
const addressBody = z.object({
  label: z.string().max(60).optional(),
  addressLine1: z.string().min(3).max(200),
  apartment: z.string().max(60).optional(),
  location: latLng,
  instructions: z.string().max(500).optional(),
});

@Controller("v1")
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

  @Public()
  @Post("auth/otp/request")
  @HttpCode(202)
  requestOtp(@Body() body: unknown) {
    return this.identity.requestOtp(parse(otpRequest, body).phone);
  }

  @Public()
  @Post("auth/otp/verify")
  @HttpCode(200)
  verifyOtp(@Body() body: unknown) {
    const input = parse(otpVerify, body);
    return this.identity.verifyOtp(input.phone, input.code);
  }

  @Public()
  @Post("auth/refresh")
  @HttpCode(200)
  refresh(@Body() body: unknown) {
    return this.identity.refresh(parse(refreshBody, body).refreshToken);
  }

  @Post("auth/logout")
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.identity.logout(user.sessionId);
  }

  @Get("me")
  getMe(@CurrentUser() user: AuthUser) {
    return this.identity.getMe(user.id);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.identity.updateProfile(user.id, parse(profilePatch, body));
  }

  @Roles("CUSTOMER")
  @Get("me/addresses")
  listAddresses(@CurrentUser() user: AuthUser) {
    return this.identity.listAddresses(user.id);
  }

  @Roles("CUSTOMER")
  @Post("me/addresses")
  @HttpCode(201)
  addAddress(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.identity.addAddress(user.id, parse(addressBody, body));
  }
}

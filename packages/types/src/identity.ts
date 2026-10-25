import { z } from "zod";

export const UserRole = z.enum([
  "CUSTOMER", "MERCHANT_OWNER", "MERCHANT_STAFF", "COURIER",
  "DISPATCHER", "SUPPORT", "FINANCE", "SUPER_ADMIN",
]);
export type UserRole = z.infer<typeof UserRole>;

export const UserStatus = z.enum(["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]);
export type UserStatus = z.infer<typeof UserStatus>;

export const User = z.object({
  id: z.uuid(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  email: z.email().optional(),
  role: UserRole,
  status: UserStatus,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type User = z.infer<typeof User>;

export const OtpRequest = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  purpose: z.enum(["LOGIN", "REGISTER", "VERIFY"]),
});
export type OtpRequest = z.infer<typeof OtpRequest>;

export const OtpVerify = OtpRequest.extend({
  code: z.string().regex(/^\d{6}$/),
});
export type OtpVerify = z.infer<typeof OtpVerify>;

export const TokenPair = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof TokenPair>;

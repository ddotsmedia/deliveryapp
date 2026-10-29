import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { SignJWT } from "jose";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { AppConfig } from "../../config.js";
import type { DbHandle } from "../../infra/db.js";
import type { OtpSender } from "../../infra/otp-sender.js";
import { AppError, forbidden, notFound, unauthorized } from "../../common/errors.js";
import { customerProfileId } from "../../common/profiles.js";
import { customerAddresses, customerProfiles, otpCodes, sessions, users } from "../../db/schema/index.js";
import { CONFIG, DB, OTP_SENDER, REDIS } from "../../tokens.js";

const OTP_RATE_LIMIT_PER_MINUTE = 5;

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

@Injectable()
export class IdentityService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(OTP_SENDER) private readonly otp: OtpSender,
  ) {}

  private get db() {
    return this.handle.db;
  }

  private hashOtp(phone: string, code: string): string {
    return createHmac("sha256", this.config.JWT_SECRET).update(`${phone}:${code}`).digest("hex");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async requestOtp(phone: string): Promise<{ expiresInSeconds: number }> {
    const key = `rl:otp:${phone}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 60);
    if (count > OTP_RATE_LIMIT_PER_MINUTE) {
      throw new AppError(429, "RATE_LIMITED", "Too many OTP requests; try again in a minute");
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + this.config.OTP_TTL_SECONDS * 1000);
    await this.db.transaction(async (tx) => {
      await tx.update(otpCodes).set({ usedAt: new Date() }).where(and(eq(otpCodes.phone, phone), isNull(otpCodes.usedAt)));
      await tx.insert(otpCodes).values({ phone, purpose: "LOGIN", codeHash: this.hashOtp(phone, code), expiresAt });
    });
    await this.otp.send(phone, code);
    return { expiresInSeconds: this.config.OTP_TTL_SECONDS };
  }

  async verifyOtp(phone: string, code: string): Promise<TokenPair & { user: { id: string; role: string } }> {
    const invalid = () => new AppError(401, "OTP_INVALID", "Code is invalid or expired");
    const [otpRow] = await this.db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.usedAt), gt(otpCodes.expiresAt, new Date())))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    if (!otpRow || otpRow.attempts >= this.config.OTP_MAX_ATTEMPTS) throw invalid();

    await this.db.update(otpCodes).set({ attempts: sql`${otpCodes.attempts} + 1` }).where(eq(otpCodes.id, otpRow.id));
    const given = Buffer.from(this.hashOtp(phone, code), "hex");
    const expected = Buffer.from(otpRow.codeHash, "hex");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid();

    const user = await this.db.transaction(async (tx) => {
      await tx.update(otpCodes).set({ usedAt: new Date() }).where(eq(otpCodes.id, otpRow.id));
      const [existing] = await tx.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (existing) {
        if (existing.status === "SUSPENDED") throw new AppError(403, "ACCOUNT_SUSPENDED", "Account is suspended");
        if (existing.status !== "ACTIVE") {
          await tx.update(users).set({ status: "ACTIVE", phoneVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, existing.id));
        }
        return existing;
      }
      // First verified login on an unknown phone registers a customer.
      const [created] = await tx
        .insert(users)
        .values({ phone, role: "CUSTOMER", status: "ACTIVE", phoneVerifiedAt: new Date() })
        .returning();
      if (!created) throw new Error("user insert returned no row");
      await tx.insert(customerProfiles).values({ userId: created.id, nameFirst: "Customer" });
      return created;
    });

    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, user: { id: user.id, role: user.role } };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, this.hashToken(refreshToken)))
      .limit(1);
    if (!session) throw new AppError(401, "REFRESH_INVALID", "Refresh token is invalid");

    if (session.revokedAt) {
      // A rotated token was presented again: treat as theft and revoke every session for the user.
      await this.db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, session.userId), isNull(sessions.revokedAt)));
      throw new AppError(401, "REFRESH_REUSED", "Refresh token reuse detected; all sessions revoked");
    }
    if (session.expiresAt.getTime() <= Date.now()) throw new AppError(401, "REFRESH_INVALID", "Refresh token expired");

    const [rotated] = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    if (!rotated) throw new AppError(401, "REFRESH_REUSED", "Refresh token already used");

    const [user] = await this.db
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user || user.status !== "ACTIVE") throw unauthorized("Account is not active");
    return this.issueTokens(user.id, user.role);
  }

  async logout(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  private async issueTokens(userId: string, role: string): Promise<TokenPair> {
    const refreshToken = randomBytes(32).toString("base64url");
    const [session] = await this.db
      .insert(sessions)
      .values({
        userId,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.config.JWT_REFRESH_TTL_SECONDS * 1000),
      })
      .returning({ id: sessions.id });
    if (!session) throw new Error("session insert returned no row");

    const accessToken = await new SignJWT({ role, sid: session.id })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${this.config.JWT_ACCESS_TTL_SECONDS}s`)
      .sign(new TextEncoder().encode(this.config.JWT_SECRET));
    return { accessToken, refreshToken, expiresIn: this.config.JWT_ACCESS_TTL_SECONDS };
  }

  async getMe(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw notFound("User");
    const [profile] = await this.db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      status: user.status,
      profile: profile
        ? { nameFirst: profile.nameFirst, nameLast: profile.nameLast, preferredLanguage: profile.preferredLanguage }
        : null,
    };
  }

  async updateProfile(userId: string, patch: { nameFirst?: string; nameLast?: string; preferredLanguage?: "en" | "ar" }) {
    const [profile] = await this.db.select({ id: customerProfiles.id }).from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
    if (!profile) throw forbidden("A customer profile is required");
    await this.db.update(customerProfiles).set({ ...patch, updatedAt: new Date() }).where(eq(customerProfiles.id, profile.id));
    return this.getMe(userId);
  }

  async listAddresses(userId: string) {
    const profileId = await customerProfileId(this.db, userId);
    return this.db.select().from(customerAddresses).where(eq(customerAddresses.customerId, profileId));
  }

  async addAddress(
    userId: string,
    input: { label?: string; addressLine1: string; apartment?: string; location: { lat: number; lng: number }; instructions?: string },
  ) {
    const profileId = await customerProfileId(this.db, userId);
    const [row] = await this.db
      .insert(customerAddresses)
      .values({
        customerId: profileId,
        label: input.label ?? null,
        addressLine1: input.addressLine1,
        apartment: input.apartment ?? null,
        location: input.location,
        instructions: input.instructions ?? null,
      })
      .returning();
    if (!row) throw new Error("address insert returned no row");
    return row;
  }
}

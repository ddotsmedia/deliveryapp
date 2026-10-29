import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { AppConfig } from "../config.js";
import type { DbHandle } from "../infra/db.js";
import { sessions, users } from "../db/schema/index.js";
import { CONFIG, DB } from "../tokens.js";
import { forbidden, unauthorized } from "./errors.js";
import { PUBLIC_KEY, ROLES_KEY, verifyAccessToken, type AuthUser } from "./auth.js";

// Deny by default: every route needs @Public() or a valid bearer token backed by a live session.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DB) private readonly handle: DbHandle,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthUser }>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw unauthorized();

    let claims: AuthUser;
    try {
      claims = await verifyAccessToken(token, this.config);
    } catch {
      throw unauthorized("Invalid or expired token");
    }

    const db = this.handle.db;
    const [row] = await db.select({ status: users.status, role: users.role }).from(users).where(eq(users.id, claims.id)).limit(1);
    if (!row || row.status !== "ACTIVE") throw unauthorized("Account is not active");

    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, claims.sessionId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!session) throw unauthorized("Session is no longer valid");

    claims.role = row.role;
    req.user = claims;

    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, targets);
    if (roles && roles.length > 0 && !roles.includes(claims.role)) throw forbidden();
    return true;
  }
}

import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";

export type AuthUser = { id: string; role: string; sessionId: string };
export const ROLES_KEY = "roles";
export const PUBLIC_KEY = "public";

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthUser }>();
  if (!req.user) throw new Error("CurrentUser used on an unauthenticated route");
  return req.user;
});

export async function verifyAccessToken(token: string, config: AppConfig): Promise<AuthUser> {
  const key = new TextEncoder().encode(config.JWT_SECRET);
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string" || typeof payload.role !== "string" || typeof payload.sid !== "string") {
    throw new Error("malformed token");
  }
  return { id: payload.sub, role: payload.role, sessionId: payload.sid };
}

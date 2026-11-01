import { randomInt } from "node:crypto";
import { runMigrations } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import { buildApp, type BuiltApp } from "../src/bootstrap.js";
import { loadConfig } from "../src/config.js";
import { CaptureOtpSender } from "../src/infra/otp-sender.js";

export const TEST_DB = process.env.DATABASE_TEST_URL ?? "postgresql://postgres:postgres@localhost:5432/uae_food_test";
export const TEST_REDIS = process.env.REDIS_TEST_URL ?? process.env.REDIS_URL ?? "redis://localhost:6379";
export const WEBHOOK_SECRET = "test-webhook-secret-0123456789";

export type Call = { status: number; body: unknown; contentType: string };

export async function startTestApp(): Promise<{ built: BuiltApp; otp: CaptureOtpSender }> {
  await runMigrations(TEST_DB);
  await seed(TEST_DB);
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DB,
    REDIS_URL: TEST_REDIS,
    JWT_SECRET: "test-secret-that-is-at-least-32-characters",
    PAYMENT_ADAPTER: "mock",
    CHECKOUT_WEBHOOK_SECRET: WEBHOOK_SECRET,
  });
  const otp = new CaptureOtpSender();
  const built = await buildApp(config, otp);
  return { built, otp };
}

export function randomE164(): string {
  return `+97150${randomInt(1_000_000, 9_999_999)}`;
}

export function makeCall(built: BuiltApp) {
  return async function call(
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    opts: { token?: string; body?: unknown; raw?: string; headers?: Record<string, string> } = {},
  ): Promise<Call> {
    const payload = opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
    const res = await built.app.getHttpAdapter().getInstance().inject({
      method,
      url,
      payload,
      headers: {
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(payload !== undefined ? { "content-type": "application/json" } : {}),
        ...(opts.headers ?? {}),
      },
    });
    return {
      status: res.statusCode,
      body: res.body.length > 0 ? JSON.parse(res.body) : undefined,
      contentType: String(res.headers["content-type"] ?? ""),
    };
  };
}

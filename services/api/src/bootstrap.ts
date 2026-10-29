import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import type { AppConfig } from "./config.js";
import { AppError } from "./common/errors.js";
import type { RawRequest } from "./common/http.js";
import type { OtpSender } from "./infra/otp-sender.js";
import { createResources, type Resources } from "./infra/providers.js";

export type BuiltApp = { app: NestFastifyApplication; resources: Resources; close: () => Promise<void> };

export async function buildApp(config: AppConfig, otpSender?: OtpSender): Promise<BuiltApp> {
  const resources = createResources(config, otpSender);
  const adapter = new FastifyAdapter({ bodyLimit: 1_048_576, allowErrorHandlerOverride: true });
  const instance = adapter.getInstance();

  instance.addHook("onRequest", (req, reply, done) => {
    const r = req as RawRequest;
    const incoming = req.headers["x-correlation-id"];
    const id = typeof incoming === "string" && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    r.correlationId = id;
    void reply.header("x-correlation-id", id);
    done();
  });

  // Keep the exact JSON bytes so webhook HMACs verify over the raw body.
  instance.removeContentTypeParser("application/json");
  instance.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    const text = String(body);
    (req as RawRequest).rawBody = text;
    if (text.length === 0) return done(null, undefined);
    try {
      done(null, JSON.parse(text));
    } catch {
      done(new AppError(400, "INVALID_JSON", "Malformed JSON body"), undefined);
    }
  });

  instance.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    const correlationId = (req as RawRequest).correlationId;
    const isApp = err instanceof AppError;
    const status = isApp ? err.status : (err as { statusCode?: number }).statusCode ?? 500;
    const code = isApp ? err.code : status < 500 ? "BAD_REQUEST" : "INTERNAL";
    if (status >= 500) resources.logger.error({ err, correlationId }, "request failed");
    void reply
      .code(status)
      .header("content-type", "application/problem+json")
      .send({
        type: `https://errors.ddotsmedia.ae/${code.toLowerCase()}`,
        title: status >= 500 ? "Internal error" : err.message,
        status,
        code,
        correlationId,
      });
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule.register(resources), adapter, { logger: false, bodyParser: false });
  await app.init();
  await instance.ready();

  return {
    app,
    resources,
    close: async () => {
      await app.close();
      resources.redis.disconnect();
      await resources.db.pool.end();
    },
  };
}

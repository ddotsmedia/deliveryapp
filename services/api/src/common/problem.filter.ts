import { ArgumentsHost, Catch, ExceptionFilter, Inject } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { isUniqueViolation } from "../db/errors.js";
import { AppError } from "./errors.js";
import { LOGGER } from "../tokens.js";
import type { Logger } from "../infra/logger.js";


// Maps every error to RFC 7807 application/problem+json.
@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest & { correlationId?: string }>();
    const reply = ctx.getResponse<FastifyReply>();
    const correlationId = req.correlationId;

    let status = 500;
    let code = "INTERNAL";
    let title = "Internal error";
    let detail: string | undefined;
    let extra: Record<string, unknown> = {};

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      title = exception.message;
      extra = exception.details ?? {};
    } else if (exception instanceof ZodError) {
      status = 422;
      code = "VALIDATION_FAILED";
      title = "Validation failed";
      extra = { issues: exception.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
    } else if (isUniqueViolation(exception)) {
      status = 409;
      code = "CONFLICT";
      title = "Resource already exists";
    } else if (exception instanceof Error && exception.message.startsWith("LEDGER_UNBALANCED")) {
      status = 500;
      code = "LEDGER_UNBALANCED";
      title = "Ledger invariant violated";
    } else if (exception instanceof Error && exception.message.startsWith("NOT_CONFIGURED")) {
      status = 503;
      code = "NOT_CONFIGURED";
      title = "Provider not configured";
    } else {
      const httpLike = exception as { status?: number; message?: string };
      if (typeof httpLike.status === "number" && httpLike.status < 500) {
        status = httpLike.status;
        code = "HTTP_ERROR";
        title = httpLike.message ?? "Request failed";
      } else {
        this.logger.error({ err: exception, correlationId }, "unhandled error");
      }
    }

    reply
      .code(status)
      .header("content-type", "application/problem+json")
      .send({
        type: `https://errors.ddotsmedia.ae/${code.toLowerCase()}`,
        title,
        status,
        code,
        detail,
        correlationId,
        ...extra,
      });
  }
}


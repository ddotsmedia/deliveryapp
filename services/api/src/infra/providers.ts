import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
import { CONFIG, DB, LOGGER, OTP_SENDER, PAYMENT_ADAPTER, REDIS } from "../tokens.js";
import { createDbHandle, type DbHandle } from "./db.js";
import { createRedis } from "./redis.js";
import { createLogger, type Logger } from "./logger.js";
import { LogOtpSender, type OtpSender } from "./otp-sender.js";
import { CheckoutPaymentAdapter, MockPaymentAdapter, type PaymentAdapter } from "./payment-adapter.js";

export type Resources = {
  config: AppConfig;
  db: DbHandle;
  redis: Redis;
  logger: Logger;
  otpSender: OtpSender;
  payment: PaymentAdapter;
};

export function createResources(config: AppConfig, otpSender: OtpSender = new LogOtpSender()): Resources {
  return {
    config,
    db: createDbHandle(config.DATABASE_URL),
    redis: createRedis(config.REDIS_URL),
    logger: createLogger(config.NODE_ENV === "test" ? "warn" : "info"),
    otpSender,
    payment: config.PAYMENT_ADAPTER === "checkout" ? new CheckoutPaymentAdapter() : new MockPaymentAdapter(),
  };
}

@Global()
@Module({})
export class InfraModule {
  static forRoot(r: Resources): DynamicModule {
    return {
      module: InfraModule,
      providers: [
        { provide: CONFIG, useValue: r.config },
        { provide: DB, useValue: r.db },
        { provide: REDIS, useValue: r.redis },
        { provide: LOGGER, useValue: r.logger },
        { provide: OTP_SENDER, useValue: r.otpSender },
        { provide: PAYMENT_ADAPTER, useValue: r.payment },
      ],
      exports: [CONFIG, DB, REDIS, LOGGER, OTP_SENDER, PAYMENT_ADAPTER],
    };
  }
}

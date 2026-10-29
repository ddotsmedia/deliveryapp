import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(level = "info"): Logger {
  return pino({ level, base: { service: "api" }, timestamp: pino.stdTimeFunctions.isoTime });
}

// Explicit DI tokens. Used instead of type metadata so the code also runs under tsx/esbuild.
export const CONFIG = Symbol("CONFIG");
export const DB = Symbol("DB");
export const REDIS = Symbol("REDIS");
export const OTP_SENDER = Symbol("OTP_SENDER");
export const PAYMENT_ADAPTER = Symbol("PAYMENT_ADAPTER");
export const LOGGER = Symbol("LOGGER");

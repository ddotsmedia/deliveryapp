import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC-SHA256 over the raw request body, hex-encoded. Constant-time compare.
export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(signPayload(rawBody, secret), "hex");
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

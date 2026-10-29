import type { ZodType, z } from "zod";

// Parses untrusted input. Throws ZodError, which the exception filter maps to 422.
export function parse<S extends ZodType>(schema: S, input: unknown): z.infer<S> {
  return schema.parse(input);
}

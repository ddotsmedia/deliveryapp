import type { FastifyRequest } from "fastify";

// Request extras set by bootstrap hooks. Kept out of module augmentation because FastifyRequest is generic.
export type RawRequest = FastifyRequest & { rawBody?: string; correlationId?: string };

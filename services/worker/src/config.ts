import { z } from "zod";

export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  OUTBOX_POLL_MS: z.coerce.number().int().min(100).default(1000),
});

export type WorkerConfig = z.infer<typeof workerEnvSchema>;

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return workerEnvSchema.parse(env);
}

import { Controller, Get, Inject, Module, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { DbHandle } from "../../infra/db.js";
import { Public } from "../../common/auth.js";
import { DB, REDIS } from "../../tokens.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: FastifyReply) {
    const [database, cache] = await Promise.all([
      this.probe(() => this.handle.pool.query("select 1")),
      this.probe(() => this.redis.ping()),
    ]);
    const ok = database && cache;
    res.code(ok ? 200 : 503);
    return { status: ok ? "ok" : "degraded", checks: { database: database ? "up" : "down", redis: cache ? "up" : "down" } };
  }

  private async probe(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch {
      return false;
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}

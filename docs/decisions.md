# Decisions

## Version fallbacks (Phase 1)
- Zod 4.3.3 used instead of Zod 3 (current major).
- openapi-fetch 0.17.0 used instead of 0.13.
- pnpm 12.15.0 (latest 12.x at build time); packageManager field pins it.
- Sandbox build ran on Node 22; project targets Node 24 (engines). Re-verify on Node 24.

## Stack
- Node 24 LTS, NestJS 11 (not 12), PostgreSQL 18 + PostGIS, Valkey 8, Drizzle, Expo SDK 58, Next.js 16, Turborepo 2.11, TypeScript 6.

## Database (Phase 2)
- Local gate ran on PostgreSQL 16.15 + PostGIS 3.4.2 (apt), not PostgreSQL 18. Docker Hub is blocked in this sandbox, so postgis/postgis:18-3.4 could not be pulled. CI and docker-compose still target postgis/postgis:18-3.4. Re-verify on PG 18 in CI.
- Local Postgres listens on 5432 here; docker-compose maps 5433.
- UUIDv7 generated in app code (src/db/uuid.ts). No DB default for ids.
- Append-only enforced by trigger (migration 0001) on audit_events, order_events, ledger_entries.
- Ledger: CHECK prevents one-sided rows. Balance per reference (debits = credits) is enforced in the Phase 3 ledger service.
- Money stored as integer fils. Operational tables carry zone_id.
- Geometry columns: geometry(Point|Polygon,4326) via custom Drizzle types (src/db/types.ts).

## API (Phase 3)
- Explicit `@Inject` tokens everywhere; `experimentalDecorators` on, `emitDecoratorMetadata` off (tsx/esbuild has no metadata).
- Nest `bodyParser: false`; a single JSON parser stores `rawBody` so webhook HMAC verifies the exact bytes.
- `fastify` pinned to 5.12.7 via pnpm `overrides` (Nest adapter otherwise pulled a second copy and broke types).
- `esbuild` build script allowed via `allowBuilds` in pnpm-workspace.yaml (needed by tsx).
- Idempotent placement uses the DB unique `orders.idempotency_key` (replays return the same order). A Redis cache layer is not implemented.
- Dispatch: offers created inside the READY transaction for online couriers in the zone, 20 s TTL. Accept inserts the assignment first (unique order_id arbitrates), then claims the offer with a conditional UPDATE.
- Phone validation is E.164 generic (`+[1-9]\d{7,14}`); UAE-specific validation is deferred.
- Deferred to later phases: admin console endpoints, notifications, support tickets, finance settlements and payouts, merchant catalog CRUD, cart modifiers, WebSocket tracking, service-area polygon check, offer-expiry sweep worker, Checkout.com adapter (stub throws NOT_CONFIGURED).

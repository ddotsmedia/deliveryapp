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

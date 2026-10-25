# Decisions

## Version fallbacks (Phase 1)
- Zod 4.3.3 used instead of Zod 3 (current major).
- openapi-fetch 0.17.0 used instead of 0.13.
- pnpm 12.15.0 (latest 12.x at build time); packageManager field pins it.
- Sandbox build ran on Node 22; project targets Node 24 (engines). Re-verify on Node 24.

## Stack
- Node 24 LTS, NestJS 11 (not 12), PostgreSQL 18 + PostGIS, Valkey 8, Drizzle, Expo SDK 58, Next.js 16, Turborepo 2.11, TypeScript 6.

# UAE Food Delivery — working agreement

1. Inspect the repo before any change. Extend existing files; never delete them.
2. Strict TypeScript. Zod at every boundary. No `any`.
3. Money: integer fils (AED). Times: UTC. IDs: UUIDv7. Operational tables carry zone_id.
4. Money and order-creating endpoints require Idempotency-Key.
5. Order status change = one transaction with order_events + outbox_messages.
6. Ledger writes must balance or are rejected.
7. Courier assignment: conditional UPDATE WHERE status = 'OPEN'.
8. No secrets in code. .env.example only. PAYMENT_ADAPTER=mock until approved.
9. Never deploy, create cloud resources, or push to a remote without explicit approval.
10. Never state a test passed unless the command ran in this session.
11. Commit per phase: "phase N: <name>".

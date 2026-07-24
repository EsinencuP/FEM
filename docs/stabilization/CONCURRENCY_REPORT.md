# Concurrency report

Updated: 2026-07-24
Status: **PASS for implemented Stage 2 invariants**

## Controls

- Bounded retry for Prisma `P2034` around serializable transactions.
- Serializable domain/reference/archive/seed operations retained from the
  stabilization baseline.
- Every mutable Admin resource has an integer `version`.
- Admin PATCH requires `If-Match`; a compare-and-increment claim occurs inside
  the same serializable transaction as the mutation and audit.
- `If-Match:*` is only a confirmed, reasoned operator override.
- Every Admin POST requires `Idempotency-Key`. The request hash, response,
  domain change and audit event commit atomically.
- Authentication consumes TOTP/recovery factors atomically and rotates session
  tokens using compare-and-update.
- PostgreSQL unique/check/FK constraints remain the final concurrency boundary.

## Executed experiments

- event shrink versus out-of-range class create: one succeeds, final invariant
  valid;
- result outcome clear versus last metric delete: one succeeds, outcome
  retained;
- duplicate slug and external identifier: one 201 and one 409;
- concurrent seed: stable logical result after retry;
- concurrent session refresh: one token rotation winner; old-token later reuse
  revokes;
- concurrent TOTP login, recovery code and TOTP re-enrollment: one winner;
- concurrent sensitive TOTP action: one 200 and one 401;
- duplicate Admin POST with same key/payload: one domain write/audit and two
  equivalent 201 responses, one marked replayed;
- same key/different payload: 409;
- two PATCH requests with version 1: one 200, one `409 STALE_VERSION`, persisted
  version 2;
- shared auth throttle across two application instances.

## Deliberate boundaries

- Membership/ownership overlap rules are not invented; official exclusivity
  rules remain pending.
- Numeric `If-Match` is the normal frontend contract. Blind automatic retry of
  409 is prohibited.
- Idempotency records expire after the documented window and are not a general
  job queue.
- PostgreSQL rate limiting is suitable for current scale; a future Redis switch
  requires equivalent atomicity and multi-instance tests.

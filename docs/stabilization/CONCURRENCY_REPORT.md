# Concurrency Report

Status: **CONDITIONAL PASS for confirmed invariants**

## Implemented controls

- Bounded retry (three attempts) for Prisma `P2034`.
- Serializable transactions for:
  - event period and class date changes;
  - result outcome and metric changes;
  - main-entity reference validation;
  - club, ownership and athlete-horse history writes;
  - external identifier writes;
  - archive and restore operations participating in parent/child checks;
  - complete demo seed.
- PostgreSQL uniqueness plus HTTP 409 mapping for event slug and normalized
  external identifier.

## Executed experiments

- Concurrent event shrink versus out-of-range class create: exactly one
  operation succeeds and the final database invariant is valid.
- Concurrent result rank clear versus last metric delete: exactly one succeeds
  and the result retains an outcome.
- Concurrent duplicate event slug: one 201 and one 409, no 500.
- Concurrent duplicate external identifier: one 201 and one 409, no duplicate.
- Concurrent seed pair: both calls complete after bounded serialization retry
  and return the same logical summary.

## Accepted limitations

- Generic PATCH remains last-write-wins.
- No `If-Match`, version column or idempotency-key protocol exists.
- Membership/ownership overlap rules are not invented; official exclusivity
  rules are pending.
- Tests create natural overlap with `Promise.all`; they do not install a
  database barrier at a chosen internal statement.

Optimistic concurrency and request idempotency are blocked by an API/client
contract decision and must not be added globally without that decision.

# Final Scorecard

Date: 2026-07-24  
Overall evidence score: **7.3/10**

| Direction                         | Score | Evidence and limiting factor                                                                                                                               |
| --------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional correctness            |   8.0 | Core CRUD invariants, archive/restore, result outcome and date rules have DB/E2E regressions. Routine endpoint permutations are not exhaustive.            |
| Data integrity                    |   8.5 | Clean migrations, UUID/FK constraints, atomic guarded seed, demo/reference boundaries and rollback tests pass. Polymorphic identifiers lack a database FK. |
| API consistency                   |   6.5 | Uniform envelopes/errors/pagination and 85 OpenAPI success contracts. No public/admin split and resource response properties are not fully typed.          |
| Validation                        |   8.5 | Strict Zod DTOs, fixed-seed fuzz, boolean/date/range/empty-PATCH/mass-assignment tests. Not every write endpoint has a complete fuzz matrix.               |
| Test quality                      |   7.0 | 65 unit, 20 DB and 34 E2E tests; three clean gates. Unit coverage is 32.88%, and one DB suite is intentionally ordered.                                    |
| Security baseline                 |   4.5 | Secret scan clean, bounded bodies, redaction, safe errors and DB guards. Auth/RBAC/2FA/rate limit/public projections are absent.                           |
| Concurrency and transactions      |   7.5 | Bounded Serializable retries, four HTTP race classes and concurrent seed pass. No optimistic locking or idempotency-key protocol.                          |
| Performance                       |   7.0 | Reproducible 10k-result fixture, bounded graphs and three measured runs. No query-plan, memory, throughput or SLA evidence.                                |
| Observability and recovery        |   7.0 | Pino, request ID, duration, health timeout, transient 503 and live DB recovery pass. No atomic application audit or monitoring backend.                    |
| Documentation and maintainability |   8.5 | Four audit cycles, registers, Graphify map and runbooks match the current private MVP. Blocked decisions remain explicit.                                  |

## Why the score is not 10

The API cannot be Internet-exposed: protected Admin and allowlisted Public
surfaces do not exist. Application audit cannot attribute or atomically record
critical mutations. Resource response DTOs, coverage, optimistic concurrency,
rate limiting, automated outage/Bruno gates and production performance evidence
remain incomplete.

No direction is rounded upward.

# Final Stabilization Report

Date: 2026-07-24  
Status: **NO-GO for public/administrative production deployment**  
Development status: **CONDITIONAL GO for continued private backend work**

## 1. Scope and baseline

The audit stabilized the existing NestJS/PostgreSQL/Prisma MVP without adding
frontend, authentication, roles, official ranking logic or new product modules.
The initial green state had 19.53% unit statement coverage, 16 DB tests,
11 read-only E2E tests, no E2E CI gate and unsafe test/seed target behavior.

## 2. Audit cycles

Four independent cycles were completed:

1. functional correctness and data integrity;
2. adversarial input, concurrency and recovery;
3. performance, contracts and system consistency;
4. independent re-audit after transaction/OpenAPI changes.

Cycle 4 was mandatory because new HIGH seed, restore and contract hypotheses
were discovered after Cycle 3.

## 3. Defect summary

The register contains 23 tracked defects:

- 3 BLOCKER-class findings;
- 2 CRITICAL;
- 15 HIGH;
- 3 MEDIUM.

There are no OPEN BLOCKER, CRITICAL or HIGH defects. Two security/audit areas
and the client concurrency protocol are explicitly
`BLOCKED_BY_BUSINESS_DECISION`, which is the scope exception allowed by the
audit mandate. They still make deployment NO-GO.

## 4. Principal fixes

- Executable local audit/test database guard in DB/E2E/seed paths.
- Atomic guarded demo seed with natural/deterministic collision preflight,
  complete rollback and bounded P2034 retry.
- Strict query booleans, non-empty PATCH, range/date/outcome validation and
  deterministic fuzz.
- Active/demo/source-document validation for primary and child graphs.
- Serializable retry for event/class, result/metric, references, history,
  identifiers, archive and restore.
- Result metric maximum 100 and list preview maximum 10.
- Safe draft-only generic competition/result mutations.
- Server-owned unverified identifiers and immutable verified identifiers.
- 100 KiB JSON limit, correlated errors, secret-free Prisma mapping and bounded
  health.
- Strict-pnpm runtime fix with supported Nest body parser.
- E2E in CI and `--detectOpenHandles`.
- Structural OpenAPI success coverage for all 85 operations.
- Bruno collection, performance fixture and updated Graphify map.

## 5. Database and migrations

No Prisma model or migration was changed. Both existing migrations applied from
empty databases in all three final gates. No `db push`, production connection
or destructive remote operation was used.

Seed ran three times per gate with the identical logical summary:

`5/1/3/3/10/12/5/3/8/36/1`

(countries/federations/disciplines/clubs/athletes/horses/owners/events/classes/
results/ranking snapshots).

## 6. Tests and quality

Final contour:

- unit: 9 suites, 65 tests;
- DB integration: 1 suite, 20 tests;
- E2E: 4 suites, 34 tests;
- unit coverage: 32.88% statements, 6.43% branches, 8.66% functions,
  35.27% lines.

Transaction evidence includes seed late-failure rollback, collision
preservation, result/metric atomicity and active reference checks.

Concurrency evidence includes event/class, result/metric, duplicate slug,
duplicate identifier and concurrent seed.

Fixed-seed fuzz uses `0x5eed1234`. Live PostgreSQL stop produced 503 and the
same backend process recovered to 200 after restart.

## 7. Three final gates

| Gate | Database                   | Prisma/migrations/seed x3 | Unit/DB/E2E   | Build | Performance | HTTP |
| ---- | -------------------------- | ------------------------- | ------------- | ----- | ----------- | ---- |
| 1    | `fem_audit_20260724_gate1` | PASS                      | 65/20/34 PASS | PASS  | PASS        | PASS |
| 2    | `fem_audit_20260724_gate2` | PASS                      | 65/20/34 PASS | PASS  | PASS        | PASS |
| 3    | `fem_audit_20260724_gate3` | PASS                      | 65/20/34 PASS | PASS  | PASS        | PASS |

HTTP smoke used compiled `dist` and checked health, Swagger UI, OpenAPI JSON,
athletes, horses, competitions and results.

One pre-gate attempt hit Windows EPERM because a previously launched Jest
process held the Prisma engine. The exact FEM Jest PID was identified and
stopped; `--detectOpenHandles` was added, and all three counted gates then
completed without a lingering process.

## 8. Performance

With 10,000 results, final result-list latency ranged 29.29–38.21 ms, count
11.58–13.89 ms, athlete search 4.33–5.04 ms and payload 37,668–37,675 bytes.
The fixture leaves zero run-prefixed residue. These local values are not an SLA.

## 9. Security and recovery

Confirmed: no known pasted Gemini key/private key pattern in tracked project
content, `.env` is not tracked, Pino redaction exists, bodies are bounded,
stack/SQL details are not exposed and test/seed URLs are guarded.

Blocked: all 53 write operations remain unauthenticated; no Public/Admin
boundary, RBAC, 2FA, rate limiting or atomic application AuditLog writer exists.

## 10. Rejected approaches

- Name-only database allowlist: rejected as remotely bypassable.
- Partial/non-transactional seed: rejected because it can overwrite or leave a
  partial graph.
- Database triggers for all archive policy: rejected as a broad hidden policy
  migration during stabilization.
- Fake authenticated/system actor: rejected because it would fabricate audit
  attribution.
- Global version column/idempotency layer: rejected without a client protocol.
- New OpenAPI/Zod generation dependency: rejected during stabilization;
  structural envelopes were used as the smaller compatible fix.

## 11. Accepted limitations

- Ordered DB constraint scenario is serial and not independently runnable by
  arbitrary test name.
- Repeat seed upserts update `updatedAt` although the logical graph is stable.
- OpenAPI resource properties remain generic inside correct envelopes.
- Generic PATCH is last-write-wins.
- Bruno CLI and Docker outage tests are not automated in CI.
- Unit coverage is low for services/controllers.
- Offset pagination, query plans and production load remain future work.

## 12. Required business decisions

1. Identity provider, auth/session model and 2FA scope.
2. Role/permission matrix and `/admin` boundary.
3. Public allowlisted fields and publication workflow.
4. Audit actor/reason/retention and append-only enforcement.
5. Optimistic concurrency/idempotency client protocol.
6. Official result, history-overlap, identifier and ranking rules.

## 13. Readiness

- Database for continued MVP API work: **READY WITH DOCUMENTED LIMITATIONS**.
- Private local API development: **CONDITIONAL GO**.
- Public website/Admin production integration: **NO-GO**.
- Internet deployment: **NO-GO**.

Overall evidence score: **7.3/10**. See `FINAL_SCORECARD.md`.

## 14. Verification commands

Use Node 22 and a dedicated local database:

```powershell
pnpm install --frozen-lockfile
pnpm db:up
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:deploy
$env:ALLOW_DEMO_SEED = "true"
pnpm prisma:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
$env:RUN_PERFORMANCE_AUDIT = "true"
pnpm test:performance
pnpm start:prod
```

Never run mutating tests or demo seed against the development or any remote
database.

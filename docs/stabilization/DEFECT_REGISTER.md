# Defect Register

Status values: `OPEN`, `IN_FIX`, `FIXED`, `BLOCKED_BY_BUSINESS_DECISION`,
`ACCEPTED_RISK`.

## STAB-001 — Audit database rejected by integration suite

- Severity: HIGH
- Category: testing, infrastructure, security
- Module: `test/database-constraints.db-spec.ts`
- Status: OPEN
- Recheck count: 1
- Evidence: lines 44–52 allow only `equestrian_federation_test` and
  `ci_database`; all 16 integration tests fail on the dedicated local database
  `fem_audit_20260723_stabilization`.
- Reproduction: set a verified local `DATABASE_URL` to the audit DB and run
  `pnpm test:db`.
- Expected: the suite accepts an explicitly authorized local ephemeral audit DB
  and rejects every remote/production-like target.
- Actual: safe audit DB is rejected; a remote database named `ci_database`
  would pass the name-only check.
- Root cause: database safety is encoded as a fixed name list without host,
  explicit opt-in or parsed URL policy.
- Affected paths: DB integration, clean-install verification, CI safety.
- Why existing tests missed it: they were run only with an allowed legacy name.
- Options:
  1. Add the new fixed name to the array. Low effort, still unsafe and brittle.
  2. Introduce a reusable guard requiring `NODE_ENV=test`, local/approved host,
     explicit audit opt-in and a test/audit database-name pattern.
- Selected solution: pending adversarial review; option 2 is the current
  candidate.
- Required regression: allowed local audit DB, rejected dev DB, rejected remote
  DB even with `ci_database` name, malformed URL.

## STAB-002 — Green tests leave core API untested

- Severity: HIGH
- Category: testing, API contract, business logic
- Module: all domain services/controllers
- Status: OPEN
- Recheck count: 1
- Evidence: 19.53% statements, 2.66% branches, 3.75% functions; most services
  and controllers report 0%.
- Reproduction: `pnpm exec jest --coverage --runInBand`.
- Expected: tests prove write validation, database effects, archive,
  publication, transaction and error behavior.
- Actual: unit tests cover infrastructure/DTO fragments; E2E covers GET lists
  and one pagination error.
- Root cause: implementation was accepted after compile/list smoke without a
  per-endpoint regression matrix.
- Affected paths: all 53 write operations and domain invariants.
- Options:
  1. Add broad controller mocks. Fast, weak evidence and prone to fake green.
  2. Add focused service unit tests plus real audit-DB integration/E2E tests
     generated from an endpoint matrix.
- Selected solution: option 2, after the initial defect inventory is complete.
- Required regression: positive, negative, boundary and mutation-sensitive
  tests per confirmed rule.

## STAB-003 — Bruno smoke gate cannot run

- Severity: MEDIUM
- Category: API contract, testing, documentation
- Module: repository tooling
- Status: OPEN
- Recheck count: 1
- Evidence: `api-client/bruno` does not exist.
- Expected: committed, secret-free collection matching current OpenAPI.
- Actual: mandatory baseline step is unavailable.
- Root cause: collection was planned but never implemented.
- Options: generate a minimal smoke collection now, or complete it after the
  OpenAPI audit to avoid encoding an incorrect contract.
- Selected solution: defer creation until the endpoint/OpenAPI audit is stable.

## STAB-004 — Boolean query value `false` is parsed as `true`

- Severity: HIGH
- Category: validation, API contract, business logic
- Module: competitions and competition results DTOs
- Status: OPEN
- Recheck count: 1
- Evidence:
  - `competition.dto.ts:81` uses `z.coerce.boolean()` for `upcoming`;
  - `competition-result.dto.ts:135` uses it for `hasRank`;
  - direct schema reproduction returns
    `{"hasRankFalse":true,"upcomingFalse":true}`.
- Expected: the query string `false` produces boolean `false`.
- Actual: JavaScript truthiness converts every non-empty string to `true`.
- Root cause: generic boolean coercion is unsuitable for HTTP query strings.
- Affected paths: competition calendar filtering, ranked/status-only result
  filtering, future public projections that reuse these DTOs.
- Why existing tests missed it: only limit validation and default list queries
  are covered.
- Options:
  1. Accept only literal strings `true|false` and transform explicitly.
  2. Add a shared query-boolean preprocessor supporting booleans plus canonical
     strings and rejecting everything else.
- Selected solution: pending API-contract review; option 2 avoids copied parsing
  logic if more boolean filters appear.
- Required regression: `true`, `false`, native booleans, missing value,
  uppercase/invalid strings and HTTP E2E count differences.

## STAB-005 — Standard E2E command can target the development database

- Severity: BLOCKER
- Category: testing, infrastructure, data integrity
- Module: E2E configuration and application bootstrap
- Status: OPEN
- Recheck count: 1
- Evidence: `test/jest-e2e.json` has no setup/guard; `AppConfigModule` loads
  `.env`; `test/app.e2e-spec.ts` does not verify the connected database.
- Reproduction: run `pnpm test:e2e` without an explicit environment override;
  the configured database is `equestrian_federation`.
- Expected: all current and future write E2E tests are structurally restricted
  to a disposable local audit/test DB.
- Actual: current GET-only tests read development data; adding required write
  tests would mutate it.
- Root cause: test isolation is an operator convention rather than executable
  policy.
- Affected paths: every future CRUD, transaction, concurrency and fuzz E2E.
- Options:
  1. Document a manual `DATABASE_URL` override. Easy to bypass; rejected as the
     sole control.
  2. Add a shared executable test-database guard and deterministic test setup,
     with explicit opt-in for disposable local names.
- Selected solution: option 2, subject to five-angle review before code changes.
- Required regression: default dev URL rejected before mutation; local audit DB
  accepted; remote and malformed URLs rejected.

## STAB-006 — Result DTO accepts a row with no outcome

- Severity: HIGH
- Category: validation, business logic, data integrity
- Module: competition results
- Status: OPEN
- Recheck count: 1
- Evidence: `CreateCompetitionResultDto.schema.safeParse` accepts only
  `competitionClassId`, `athleteId` and `horseId`; `RESULT_FIELDS.md:117-124`
  requires at least one outcome directly or through metrics.
- Expected: a result has rank, status, display/numeric outcome or a valid metric.
- Actual: an outcome-less result is accepted and persisted.
- Root cause: the relational minimum was implemented, but the documented
  cross-field service invariant was omitted.
- Affected paths: create/update result, publication readiness, ranking evidence.
- Options:
  1. DTO cross-field refinement including nested metrics.
  2. Service validation against the final persisted state, used for create,
     update and publication; DTO still rejects obviously empty creates.
- Selected solution: likely combined option 1 + 2 because PATCH requires final
  state validation. Final choice awaits business-rule review.
- Required regression: positive status-only/rank/text/metric cases; empty,
  null-only and PATCH-removes-last-outcome negatives; boundary metric cases.

## Pending independent findings

Database, security/API and QA/reliability agents are still collecting evidence.
Their claims will be added only after source confirmation and reproduction.

# Defect Register

Status values: `OPEN`, `IN_FIX`, `FIXED`, `FIXED_WITH_RESIDUAL_RISK`,
`BLOCKED_BY_BUSINESS_DECISION`, `ACCEPTED_RISK`.

## STAB-001 — Audit database rejected by integration suite

- Severity: HIGH
- Category: testing, infrastructure, security
- Module: `test/database-constraints.db-spec.ts`
- Status: FIXED
- Recheck count: 9
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
- Status: FIXED
- Recheck count: 2
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
- Status: FIXED
- Recheck count: 11
- Evidence: a secret-free local collection now covers health, every existing
  resource list and a negative pagination case; Public API requests cannot be
  added because that surface does not exist.
- Expected: committed, secret-free collection matching current OpenAPI.
- Actual: the collection is present, but Bruno CLI execution and Public API
  coverage remain unavailable.
- Root cause: collection was planned but never implemented.
- Options: generate a minimal smoke collection now, or complete it after the
  OpenAPI audit to avoid encoding an incorrect contract.
- Selected solution: defer creation until the endpoint/OpenAPI audit is stable.

## STAB-004 — Boolean query value `false` is parsed as `true`

- Severity: HIGH
- Category: validation, API contract, business logic
- Module: competitions and competition results DTOs
- Status: FIXED
- Recheck count: 3
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
- Status: FIXED
- Recheck count: 3
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
- Status: FIXED
- Recheck count: 2
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

## STAB-007 — Demo seed can overwrite non-demo rows and commit partial data

- Severity: CRITICAL
- Category: data integrity, transaction, infrastructure
- Module: `prisma/seed.ts`
- Status: FIXED
- Recheck count: 6
- Evidence:
  - the CLI accepts every `DATABASE_URL` and has no explicit demo-seed sentinel;
  - country upserts use real ISO keys and update `isDemo`, names and archive
    state;
  - event/ranking-definition upserts use natural keys but their children use a
    separately calculated deterministic parent ID;
  - the complete seed is not wrapped in one transaction.
- Reproduction: in a disposable DB create a non-demo `MD` country and an event
  with slug `demo-event-1` under another UUID, then run the seed. The country is
  overwritten before the class FK fails.
- Expected: an unsafe target or any non-demo key collision is rejected before
  the first write; a mid-seed failure rolls back everything.
- Actual: legitimate rows can be changed to demo and failure leaves a partial
  graph.
- Root cause: target safety, collision preflight, identity strategy and
  transaction ownership were omitted from one large operational command.
- Affected paths: every seeded model, especially Country/Federation,
  Event/Class/Result and RankingDefinition/RuleSet/Period.
- Why existing tests missed it: they compare only selected summary counts on an
  already compatible database.
- Options:
  1. Explicit local/test target guard, opt-in sentinel, full collision preflight,
     returned IDs and one serializable transaction.
  2. A physically separate demo database/schema with a restricted database
     role.
- Selected solution: option 1 for the repository baseline; option 2 remains the
  deployment recommendation.
- Ten-angle review:
  - Correctness/data: fixes the overwrite and partial-commit root causes.
  - Compatibility: intentionally requires an explicit seed opt-in and README/CI
    update; data shape remains unchanged.
  - Security: rejects remote and production-like targets without printing the
    URL.
  - Performance: one bounded transaction is acceptable for the small demo set.
  - Maintainability/testability: one exported guard and collision preflight are
    directly testable.
  - Reliability/adversarial: wrong host, wrong DB, natural-key collision and
    injected failure must all fail before/without persistent writes.
  - Simplicity: safer than adding a second Compose stack during stabilization.
- Required regression: URL matrix, natural-key and deterministic-ID non-demo
  collision preservation, forced rollback, concurrent Serializable retry and
  three stable logical summaries.
- Resolution evidence: the preflight now covers every model updated by
  deterministic UUID, including ranking children without `isDemo`; a non-demo
  `club:1` collision is preserved and rejected. Concurrent seed runs use the
  shared bounded P2034 retry and both complete with the same logical summary.
  `updatedAt` churn on a repeat upsert remains an accepted MEDIUM operational
  limitation; it does not duplicate or partially commit the demo graph.

## STAB-008 — Demo and non-demo rows can be mixed through API child writes

- Severity: HIGH
- Category: data integrity, business logic
- Module: historical relations, results, metrics, external identifiers
- Status: FIXED
- Recheck count: 4
- Evidence: relation/child models default `isDemo=false`; their DTOs hide the
  field and create services neither inherit nor compare parent demo flags.
- Reproduction: create a membership, ownership, athlete-horse relation, result,
  metric or identifier under seeded demo parents; the child is non-demo.
- Expected: a connected graph cannot silently cross the demo boundary.
- Actual: API defaults create mixed graphs that future public filters may leak.
- Root cause: `isDemo` is treated as a row attribute rather than a graph
  invariant.
- Options:
  1. In a transaction require compatible parent boundaries and derive the child
     value server-side.
  2. Separate demo and official data physically.
- Selected solution: option 1 for API writes, with option 2 recommended for
  production operations.
- Ten-angle review: correctness and data integrity improve; the response
  contract is unchanged; extra parent selects add bounded cost; centralized
  helpers reduce copied rules; concurrency tests must attempt archive/demo
  changes between validation and create; mixed parents must be rejected.
- Required regression: all-demo inheritance, all-non-demo inheritance,
  mixed-parent rejection, metric/identifier inheritance and public ancestor
  filtering.
- Resolution evidence: main entities now validate active Country/Federation/
  Media references and derive or preserve their boundary; relations, results,
  metrics, identifiers and source documents use the same rule. Reparenting a
  class with results or result with metrics across the boundary returns 409.

## STAB-009 — Event date update can invalidate existing classes

- Severity: HIGH
- Category: business logic, data integrity, transaction
- Module: competitions
- Status: FIXED
- Recheck count: 3
- Evidence: class create/update validates its date against the event, but event
  update validates only `startDate <= endDate`.
- Reproduction: create an event for 1–10 August with a class on 8 August, then
  shrink the event to 1–5 August.
- Expected: the update is rejected atomically while any class would fall
  outside the new period.
- Actual: the database retains an invalid cross-table state.
- Root cause: the invariant is implemented only from child to parent.
- Options:
  1. Transactionally detect out-of-range classes and reject event update.
  2. Introduce a separate preview/confirm rescheduling command.
- Selected solution: option 1; option 2 is unnecessary workflow expansion.
- Ten-angle review: no schema/API shape change; one indexed child existence
  query is bounded; transaction prevents partial update; a concurrent class
  insert must be covered by an adversarial test and suitable isolation.
- Required regression: widening, narrowing, exact boundaries, null class date,
  concurrent class-create/date-shrink and rollback.

## STAB-010 — Archive state is not enforced consistently on write/restore paths

- Severity: HIGH
- Category: business logic, data integrity, concurrency
- Module: all relations, classes, results, metrics, identifiers
- Status: FIXED
- Recheck count: 5
- Evidence: class/result restore does not verify ancestors; metrics can be
  changed under archived results; athlete/horse/identifier assertions check
  existence only; result lists do not always exclude archived ancestors.
- Expected: archived records cannot receive new children or reappear through an
  active child without an explicit documented policy.
- Actual: different modules apply incompatible archive rules and expose TOCTOU
  windows.
- Root cause: archive handling is copied locally and is mostly a list filter,
  not a write invariant.
- Options:
  1. Shared active-parent checks inside write transactions plus explicit restore
     policy per relation.
  2. PostgreSQL triggers/active-entity registry for all cross-table rules.
- Selected solution: option 1 for current Prisma API; database triggers are
  rejected for now because they hide application policy and require a broad
  migration.
- Ten-angle review: preserves the archive API; adds small indexed reads;
  improves clarity if helpers remain domain-specific; transactions/rechecks
  must cover intentional races; direct SQL remains an accepted local limitation.
- Required regression: archived parent matrix, restore under archived parent,
  metric mutation under archived result, list under archived ancestors,
  archive/create and restore/update races.
- Resolution: generic PATCH rejects archived primary entities; all primary,
  class and result restore paths revalidate active referenced parents;
  relation, identifier and metric writes validate active parents inside bounded
  Serializable transactions. Archive/update operations that participate in
  these races use the same isolation helper. Repeated archive/restore is
  intentionally idempotent at the state level and has an HTTP regression.
  Public visibility of archived history is tracked only under STAB-017.

## STAB-011 — External identifier verification provenance is client-controlled

- Severity: HIGH
- Category: security, audit, data integrity, API contract
- Module: external identifiers
- Status: FIXED
- Recheck count: 4
- Evidence: clients can set `normalizationVersion`, `verificationStatus`,
  `verifiedAt` and `isPrimary`; the server never sets `verifiedById`, yet reports
  the identifier as verified.
- Expected: normalization policy and verification provenance are server-owned
  and auditable.
- Actual: unauthenticated callers can fabricate verification evidence.
- Root cause: future administrative workflow fields were exposed through the
  MVP CRUD DTO before authentication/actor semantics existed.
- Options:
  1. Until auth exists, accept only `UNVERIFIED`, own normalization metadata
     server-side, and make verification a future dedicated command.
  2. Implement an authenticated verification transition with actor, evidence
     and AuditLog in one transaction.
- Selected solution: option 1 is the safe stabilization behavior; option 2 is
  prohibited by the current no-auth scope.
- Ten-angle review: option 1 narrows an unsafe API contract and may be a
  deliberate breaking change; it has negligible performance cost, is simple to
  test, and prevents fabricated provenance but cannot establish real identity.
- Required regression: forbidden verified create/update, server-owned
  normalization version, archived target rejection and duplicate race.
- Resolution evidence: a verified identifier is immutable through generic
  PATCH and returns `VERIFIED_IDENTIFIER_IMMUTABLE`; replacement remains a
  future audited workflow.
- Business question: who may verify an identifier and what evidence is
  mandatory?

## STAB-012 — Application has no working append-only audit trail

- Severity: HIGH
- Category: audit, security, transaction
- Module: all critical mutations
- Status: BLOCKED_BY_BUSINESS_DECISION
- Recheck count: 4
- Evidence: no application path writes `AuditLog`; archive, restore, publication
  and identifier changes are unaudited; PostgreSQL does not make AuditLog
  append-only.
- Expected: critical changes produce redacted, atomic audit evidence.
- Actual: only the table and documentation exist.
- Root cause: storage was modeled before actor/authentication and mutation
  orchestration.
- Options:
  1. Domain mutation plus redacted AuditLog in one application transaction and
     a database role that cannot update/delete audit rows.
  2. Database trigger/outbox with transaction-local actor/request context.
- Selected solution: pending actor/auth decision. A nullable actor could record
  an unattributed technical event, but adding non-atomic best-effort audit in an
  interceptor would not satisfy the stated invariant. A truthful atomic audit
  requires the approved mutation/actor policy and is outside the explicit
  no-auth/no-new-feature stabilization scope.
- Ten-angle review: both can protect integrity; option 1 is clearer for Prisma
  but depends on authenticated actor context; option 2 is stronger against
  alternate writers but operationally complex. Fake system actors are rejected.
- Required regression after decision: atomic write+audit, rollback, redaction,
  immutable-role check and request-ID propagation.

## STAB-013 — CI omits HTTP E2E

- Severity: HIGH
- Category: testing, infrastructure
- Module: `.github/workflows/ci.yml`
- Status: FIXED
- Recheck count: 3
- Evidence: CI runs unit, migrations, seed and DB constraints, then build; it
  never executes `pnpm test:e2e`.
- Expected: a broken route/filter/controller makes CI fail.
- Actual: the HTTP contract can regress while CI remains green.
- Root cause: the workflow predates the REST surface.
- Options:
  1. Add E2E after migration/seed using the existing ephemeral PostgreSQL.
  2. Create a single orchestration command for every CI gate.
- Selected solution: option 1 first; orchestration is useful only after all
  suites are stable.
- Ten-angle review: no runtime compatibility risk; modest CI time; the shared
  executable DB guard must explicitly allow CI localhost; failure is easy to
  test by mutation sanity.
- Required regression: CI-local equivalent executes E2E and a deliberately
  broken route/filter test fails.

## STAB-014 — Result list/detail can return an unbounded child graph

- Severity: HIGH
- Category: performance, API contract
- Module: competition results
- Status: FIXED
- Recheck count: 4
- Evidence: a list of 100 results includes up to 100 metrics each; detail loads
  all metrics and metrics can be added without an aggregate limit.
- Expected: list payload and query work are predictably bounded.
- Actual: one list can materialize 10,000 child rows and detail has no ceiling.
- Root cause: metric preview and full metric collection share the same response
  shape.
- Options:
  1. Remove metrics from result lists and provide a paginated metric endpoint.
  2. Keep a small preview plus total and paginate the full collection.
- Selected solution: pending API-contract review; option 2 preserves more
  compatibility while bounding payload.
- Ten-angle review: both are correct; both alter response shape; indexed child
  pagination is cheap; option 2 is more complex but less breaking. Measurements
  on the performance seed are required before selection.
- Required regression: query count, payload ceiling and latency smoke on a
  large metric set.
- Resolution: the established 100-metric create limit is now enforced for
  incremental POST as well. Lists return a 10-item preview plus `_count`;
  detail returns at most the complete 100-item API-supported set plus `_count`.

## STAB-015 — Transient Prisma failures can become generic 500 responses

- Severity: HIGH
- Category: reliability, error handling, observability
- Module: global exception filter and health
- Status: FIXED_WITH_RESIDUAL_RISK
- Recheck count: 3
- Evidence: only selected known-request, initialization and panic errors are
  mapped; pool timeout/connection loss classes are not proven to return 503;
  health has no explicit bounded timeout.
- Expected: transient DB unavailability produces a bounded, secret-free 503 and
  recovers after the database returns.
- Actual: untested variants can fall through to generic 500 or wait on driver
  timeouts.
- Root cause: error taxonomy and recovery testing are incomplete.
- Options:
  1. Explicitly classify transient Prisma codes/classes and bound readiness
     checks.
  2. Rely on infrastructure proxy timeouts only.
- Selected solution: option 1; infrastructure is defense in depth, not an API
  contract.
- Ten-angle review: mapping must not misclassify data errors; no data mutation;
  stable error shape; negligible normal-path cost; outage/recovery and secret
  leakage tests are mandatory.
- Required regression: stopped DB, recovery, pool timeout, malformed URL and
  bounded health response.
- Resolution progress: P1001/P1002/P1008/P1017/P2024 map to a secret-free 503,
  exhausted P2034 maps to retryable 409, and health is bounded to three seconds.
  A live Compose stop returned 503 and the same application process recovered
  to health 200 after PostgreSQL restarted.
- Residual MEDIUM: the timeout bounds the HTTP readiness response but does not
  cancel the underlying Prisma promise; an automated Docker outage gate is not
  part of CI.

## STAB-016 — Ownership share validation disagrees with PostgreSQL constraint

- Severity: MEDIUM
- Category: validation, API contract, data integrity
- Module: horse ownership
- Status: FIXED
- Recheck count: 3
- Evidence: DTO accepts `0`; the migration check requires
  `ownershipShare > 0 AND <= 100`.
- Expected: invalid input is rejected consistently before the database.
- Actual: `0` passes DTO and fails later as `P2004`.
- Root cause: duplicated boundary rules drifted.
- Options: make DTO positive, or relax the DB check if zero is a valid business
  value.
- Selected solution: positive DTO matches current schema and documentation;
  zero-valid semantics remain a business question if requested later.
- Required regression: zero, minimal positive decimal, 100 and over-100.

## STAB-017 — Public and administrative API boundaries are absent

- Severity: BLOCKER
- Category: security, API contract, architecture
- Module: complete HTTP surface
- Status: BLOCKED_BY_BUSINESS_DECISION
- Recheck count: 2
- Evidence: 53 write operations are unauthenticated, no security scheme exists,
  there are no `/public` or `/admin` controllers, and default reads return draft
  data.
- Expected: public routes expose only published/non-archived allowlisted fields;
  administrative writes are protected before Internet exposure.
- Actual: the sole unauthenticated surface mixes reads and writes and accepts
  direct publication changes.
- Root cause: the MVP CRUD surface was built before access-control and public
  projections.
- Options:
  1. Keep the API local/private, add public read-only projections now, and defer
     protected admin exposure until auth.
  2. Implement authentication/permissions and split admin/public routes.
- Selected solution: option 1 is the maximum allowed by current scope; option 2
  is explicitly prohibited in this stabilization task.
- Ten-angle review: public serializers and published/active predicates are
  testable and low-risk; duplicating business queries must be avoided; no
  unauthenticated write can be considered safe for deployment; documentation
  must remain explicit.
- Required regression: draft/archived/internal/demo exclusion on every public
  route and proof that administrative API is not advertised as public.

## STAB-018 — OpenAPI materially under-specifies the runtime contract

- Severity: HIGH
- Category: API contract, documentation, testing
- Module: Swagger decorators and DTO metadata
- Status: FIXED_WITH_RESIDUAL_RISK
- Recheck count: 3
- Evidence: 59 paths/85 operations contain only 17 operation summaries and one
  typed success response; several nullable fields render as generic objects.
- Expected: request, query, success and error contracts match actual JSON.
- Actual: generated clients cannot reliably infer most responses.
- Root cause: controllers were implemented before a response-schema/contract
  review.
- Options:
  1. Add explicit response DTOs/decorators per endpoint.
  2. Generate schemas from shared Zod/OpenAPI definitions.
- Selected solution: preserve explicit typed responses such as health and add
  reusable success/list envelope schemas to every otherwise-undocumented 2xx
  operation. Introducing another schema-generation dependency or 85 new
  response classes is not justified during stabilization.
- Ten-angle review: documentation-only runtime impact; substantial maintenance
  volume; contract tests must compare live responses against OpenAPI rather than
  checking annotation presence only.
- Required regression: all 85 operations have a 2xx contract; health retains
  its bare typed response; nested identifier list uses the list envelope;
  representative live response envelopes are covered by E2E.
- Residual MEDIUM: envelope contents intentionally allow additional resource
  properties, so generated clients do not receive complete scalar/relation
  types. This is accepted only for the private MVP surface and must be replaced
  by explicit public/admin response DTOs when STAB-017 is resolved.

## STAB-019 — Oversized JSON is reported as 500 and request limits are implicit

- Severity: HIGH
- Category: security, API contract, reliability
- Module: Nest/Express bootstrap and exception filter
- Status: FIXED
- Recheck count: 2
- Evidence: safe runtime probe of an oversized JSON body returned 500; body-size
  policy is not configured or documented.
- Expected: oversized input is rejected as bounded 413 without stack, SQL or
  secret leakage.
- Actual: parser failure is normalized as a generic internal error.
- Root cause: framework parser errors are not included in the error taxonomy.
- Options:
  1. Configure explicit JSON/urlencoded limits and map payload-too-large to the
     standard 413 envelope.
  2. Rely solely on a reverse proxy limit.
- Selected solution: option 1 with a conservative documented limit; proxy
  remains defense in depth.
- Ten-angle review: no data risk; explicit compatibility limit; mitigates memory
  abuse; trivial steady-state cost; boundary and malformed-body tests required.
- Required regression: just-below/at/above limit, malformed JSON, stable process
  after rejection and secret-free response.

## STAB-020 — Concurrency and retry semantics are undefined

- Severity: HIGH
- Category: concurrency, transaction, API contract
- Module: write API
- Status: BLOCKED_BY_BUSINESS_DECISION
- Recheck count: 4
- Evidence: write paths have no version precondition or idempotency key;
  parent-check/create sequences are TOCTOU; duplicate unique errors are mapped,
  but lost updates and retry duplicates are not addressed.
- Expected: critical retries and conflicting concurrent mutations have explicit
  deterministic behavior.
- Actual: last-write-wins PATCH and duplicate POST are possible where no
  database unique key exists.
- Root cause: CRUD semantics were implemented without an agreed optimistic
  concurrency/idempotency contract.
- Options:
  1. Conditional updates using `updatedAt` plus scoped idempotency storage for
     critical POST operations.
  2. Add a version column and centralized command/idempotency layer broadly.
- Selected solution: pending contract decision; applying versioning to every
  model without a client protocol would be overengineering.
- Ten-angle review: either option changes client behavior and may require a
  migration; correctness gains are real only for identified critical commands;
  storage/cleanup/security of idempotency keys must be designed; unique/FK
  races can still be fixed independently.
- Required regression after decision: same-version parallel PATCH, same-key
  POST retry, archive/create race and no unexplained 500.
- Resolution progress: event/class and result/metric cross-row invariants now
  use bounded Serializable retries. The same helper now protects
  reference-validation, historical relation, identifier, archive and restore
  transactions; seed retries P2034. Real concurrent HTTP regressions prove no
  out-of-range class, no result without an outcome, and deterministic 409 for
  duplicate slug/identifier writes. General lost-update and idempotency
  semantics remain blocked by a client protocol/versioning decision.

## Accepted/documented lower-severity risks

- Polymorphic `ExternalIdentifier`, `AuditLog.entityId` and import links have no
  database FK. The API must resolve targets transactionally; a registry or
  periodic orphan monitor is deferred until importer/integration writers exist.
- Offset pagination allows very large page numbers and `findMany + count` may
  observe different snapshots under concurrent writes. Measure and document
  before adopting cursor pagination or stricter isolation.
- The Express fingerprint was removed with the explicit shared HTTP bootstrap;
  broader security-header and CORS policy remains part of STAB-017.

## STAB-021 — Built application imports undeclared transitive Express package

- Severity: BLOCKER
- Category: infrastructure, reliability
- Module: HTTP bootstrap
- Status: FIXED
- Recheck count: 2
- Evidence: `node dist/src/main.js` failed with `Cannot find module 'express'`
  although compile/build and Jest were green.
- Root cause: the bootstrap imported Express body-parser functions directly
  while strict pnpm exposed Express only inside `@nestjs/platform-express`.
- Options: declare Express directly, or use NestExpressApplication's supported
  body-parser API.
- Selected solution: use `NestExpressApplication.useBodyParser`; it avoids a
  redundant dependency and follows the selected Nest adapter.
- Regression: real compiled startup on an audit DB returned health 200; CI
  runtime smoke remains to be automated.

## STAB-022 — Generic mutation DTOs allow unaudited publication

- Severity: CRITICAL
- Category: security, API contract, audit
- Module: competitions and results
- Status: FIXED_WITH_RESIDUAL_RISK
- Recheck count: 2
- Evidence: ordinary POST/PATCH accepted `publicationStatus=PUBLISHED` and set
  `publishedAt` without actor, approval or audit.
- Options: dedicated authenticated publish/withdraw commands, or reject all
  publication transitions until that workflow exists.
- Selected solution: reject publication fields in generic mutation DTOs. This
  is the only truthful behavior while authentication/audit are prohibited.
- Regression: create and update DTOs for competitions/results reject
  publication fields; seed can still create explicit demo drafts directly.

## STAB-023 — Integration fixtures are partially order-dependent

- Severity: MEDIUM
- Category: testing, reliability
- Module: database and HTTP test suites
- Status: ACCEPTED_RISK
- Recheck count: 3
- Evidence: the stabilization E2E dependency on a preceding event test and its
  shared-club mutation were removed. The DB constraint file remains a deliberate
  serial scenario: individual mid-file tests depend on fixtures created by
  earlier cases, and forced-trigger cleanup depends on `finally`.
- Options: per-test fixture factories with transaction/run IDs, or isolated
  database/schema per suite.
- Selected solution: independent/run-scoped E2E fixtures now; retain the DB
  scenario suite under `--runInBand` and the executable disposable-DB guard.
  Per-test DB factories or per-suite schemas remain the stronger follow-up.
- Acceptance rationale: this is a test-maintainability/flakiness risk, not a
  production data risk; three clean serial gates are required. Running arbitrary
  mid-file DB tests by name is not currently supported and is documented.

## STAB-024 — Administrative domain surface was anonymous

- Severity: CRITICAL
- Category: security, API contract
- Module: all domain controllers
- Status: FIXED
- Recheck count: 3
- Evidence: the prior stabilization inventory exposed 53 mutation operations
  without an authentication scheme.
- Root cause: the private MVP deliberately deferred the security boundary.
- Options: bolt guards onto mixed routes, or establish a distinct Admin
  namespace with a central security policy.
- Selected solution: move all domain controllers to `/api/v1/admin/*`; protect
  them with opaque session, permission and CSRF guards. The future Public API is
  a separate allowlist projection.
- Regression: anonymous Admin list/write returns 401; OpenAPI declares the
  cookie scheme; no legacy domain route is registered.

## STAB-025 — Domain changes and audit evidence could diverge

- Severity: CRITICAL
- Category: audit, transaction, security
- Module: serializable Admin transaction boundary
- Status: FIXED
- Recheck count: 3
- Evidence: the initial AuditLog model had no shared mutation writer and actor
  attribution was nullable for all real changes.
- Root cause: audit was modeled before an authenticated request context existed.
- Selected solution: AsyncLocalStorage request context plus same-transaction
  redacted old/new audit writes; append-only database triggers and restrictive
  actor/session FKs.
- Regression: forced audit insert failure rolls back the domain insert; update,
  delete and truncate of AuditLog are rejected by PostgreSQL.

## STAB-026 — Authentication throttle was process-local

- Severity: HIGH
- Category: security, reliability
- Module: throttler storage
- Status: FIXED
- Recheck count: 2
- Evidence: an in-memory quota can be bypassed across instances and resets on
  every restart.
- Selected solution: atomic PostgreSQL-backed named buckets with validated
  per-surface limits.
- Regression: two independent Nest application instances share the login quota;
  spoofed forwarding headers do not split it with zero trusted proxies.

## STAB-027 — Session and second-factor lifecycle was incomplete

- Severity: HIGH
- Category: security
- Module: auth
- Status: FIXED
- Recheck count: 3
- Evidence: the prior baseline had no credential, session, refresh, logout,
  lockout, recovery or re-enrollment implementation.
- Selected solution: Argon2id, encrypted TOTP, hashed recovery codes, opaque
  session rotation, idle/absolute expiry, token-reuse revocation, lockout and a
  two-step recovery-only TOTP replacement.
- Regression: auth, lifecycle, lockout and hardening E2E suites.

## STAB-028 — Retried Admin writes could duplicate or overwrite changes

- Severity: HIGH
- Category: concurrency, API contract
- Module: all Admin writes
- Status: FIXED
- Recheck count: 2
- Evidence: repeated POST had no request identity and generic PATCH was
  last-write-wins.
- Selected solution: transaction-bound idempotency records for POST and
  per-resource optimistic versions for PATCH.
- Regression: concurrent duplicate POST has one write/audit; conflicting
  payload returns 409; same-version concurrent PATCH has one winner.

## STAB-029 — ADMIN role implied unrestricted authority

- Severity: HIGH
- Category: authorization
- Module: auth and audit
- Status: FIXED
- Recheck count: 2
- Evidence: role membership alone granted every protected operation.
- Root cause: no persisted permission vocabulary or role mapping existed.
- Selected solution: additive `Permission` and `RolePermission` models plus a
  guard for `ADMIN_READ`, `ADMIN_WRITE`, `AUDIT_READ` and `SECURITY_SELF`.
- Regression: removing `ADMIN_READ` while retaining the active `ADMIN` role
  returns 403 `PERMISSION_DENIED`.

## STAB-030 — Sensitive TOTP actions could race outside the transaction

- Severity: HIGH
- Category: security, concurrency
- Module: password and recovery-code lifecycle
- Status: FIXED
- Recheck count: 2
- Evidence: password/TOTP verification occurred before the serializable write,
  allowing parallel reuse of the same timestep and stale current password.
- Selected solution: verify current credential and atomically claim
  `lastTotpStep` inside the same transaction as the sensitive change.
- Regression: two concurrent recovery-code rotations with one TOTP timestep
  produce one 200 and one 401; password change revokes other sessions.

## STAB-031 — Recovery factor inherited full Admin permissions

- Severity: CRITICAL
- Category: authorization, security
- Module: permissions guard
- Status: FIXED
- Recheck count: 2
- Evidence: `secondFactorMethod=RECOVERY` was returned to the principal but not
  considered by authorization, so a recovery code created an otherwise normal
  Admin session.
- Root cause: factor provenance was modeled for re-enrollment but omitted from
  the permission decision.
- Options: treat recovery code as a complete equal factor, or create a
  constrained recovery session that can only repair TOTP and log out.
- Selected solution: constrained recovery session. Only `me`, logout and TOTP
  re-enrollment start/confirm are allowed; domain Admin access returns 403 until
  confirmation upgrades the factor or a separate TOTP login succeeds.
- Regression: a real recovery-code login receives
  `RECOVERY_SESSION_RESTRICTED` on Admin list and a later TOTP login regains
  normal permission checks.

## STAB-032 — Active rate-limit block was reset with the original window

- Severity: HIGH
- Category: security, reliability
- Module: PostgreSQL throttler storage
- Status: FIXED
- Recheck count: 2
- Evidence: the reset branch evaluated expired `expiresAt` before honoring a
  still-future `blockedUntil`.
- Root cause: counting-window expiry and penalty expiry were treated as one
  lifecycle.
- Options: extend the counting window to the block deadline, or give an active
  block precedence over window reset.
- Selected solution: active `blockedUntil` is authoritative; reset occurs only
  after the block expires.
- Regression: a valid expired window with a future block remains 429; after the
  block expires the same bucket resets to one hit.

## STAB-033 — Wildcard optimistic-version override inherited normal write authority

- Severity: HIGH
- Category: authorization, concurrency
- Module: Admin PATCH guard
- Status: FIXED
- Recheck count: 2
- Evidence: any `ADMIN_WRITE` principal could submit `If-Match: *`.
- Root cause: the emergency override was parsed as a version value but not
  modeled as separate authority.
- Options: remove wildcard support, or protect it with a dedicated permission
  and critical-action evidence.
- Selected solution: `VERSION_OVERRIDE` plus confirmation and reason. Numeric
  `If-Match` remains the ordinary frontend contract.
- Regression: without permission returns 403; without confirmation returns 400;
  authorized override increments once and writes actor/session/reason and exact
  before/after versions to audit.

## STAB-034 — Runtime database role could control audit and migration evidence

- Severity: CRITICAL
- Category: database, security, migration
- Module: production database credentials
- Status: FIXED
- Recheck count: 3
- Evidence: the first capability draft granted DML on every public table,
  including `_prisma_migrations`, reused a cluster-global role and committed
  that unsafe state before a later hardening migration.
- Root cause: privilege separation stopped at AuditLog trigger protection and
  did not define a complete runtime/deployment matrix.
- Options: retain a global role with a deny-list, or use a database-scoped
  capability with an explicit allowlist and fail-closed startup verification.
- Selected solution: the first unpublished role migration now directly creates
  the deterministic database-scoped NOLOGIN capability with explicit table
  privileges, no default grants and no migration-history access. Production
  startup verifies exact membership, both role attribute sets, ownership,
  default ACL, membership options and the complete effective table/column ACL
  matrix. It also rejects grant options, unexpected schemas, views/materialized
  views/foreign relations, sequences, functions, non-baseline PUBLIC system
  ACL, direct system grants and implicit ownership across PostgreSQL object
  classes.
- Regression: a real member performs required runtime DML but cannot read or
  mutate migration history, permission configuration, audit history or
  triggers; owner/dangerous/extra-membership credentials fail production
  startup; malicious pre-existing LOGIN, ownership or default-ACL capabilities
  abort before any grant. Negative startup probes cover missing required ACL,
  table and column privilege escalation, grant options, both membership
  directions/options, login/capability ownership/default ACL, an owner-backed
  migration-history view, a non-public user schema, PUBLIC application/system
  grants and large-object ownership.
  Cluster-boundary regressions also cover PUBLIC parameter privilege,
  adjacent-database CONNECT and a role-level `session_replication_role=replica`
  default on a fresh connection.

## STAB-035 — Expired rate-limit buckets had no retention path

- Severity: HIGH
- Category: security, performance, reliability
- Module: PostgreSQL throttler storage
- Status: FIXED
- Recheck count: 2
- Evidence: source-IP and route cardinality could create permanent expired rows.
- Root cause: shared persistence was added without lifecycle cleanup.
- Options: external limiter storage with TTL, a background cleanup job, or
  bounded opportunistic cleanup in the existing store.
- Selected solution: every 128 operations each instance attempts a separate
  500-row `SKIP LOCKED` batch. Cleanup failure is logged and isolated from the
  request. A dedicated limiter remains an evidence-based scale option.
- Regression: two instances reclaim 750 stale fixtures in bounded batches while
  active blocked rows survive.

## STAB-036 — A future Admin PATCH route could bypass version claiming

- Severity: HIGH
- Category: concurrency, maintainability, API contract
- Module: serializable Admin transaction boundary
- Status: FIXED
- Recheck count: 2
- Evidence: an unrecognized Admin entity silently returned from the version
  switch.
- Root cause: the mapping default favored compatibility over fail-closed write
  integrity.
- Selected solution: unknown Admin PATCH entities throw before mutation; an
  OpenAPI inventory test requires every registered Admin PATCH route to match a
  supported versioned resource shape.
- Regression: current route inventory is complete and wildcard/numeric version
  tests remain green.

## Independent-review hypothesis reconciliation

Three previously reported HIGH hypotheses were rejected after re-reading the
current source and executing regressions:

- auth audit resolves `sessionId` from the event or request audit context;
- password and recovery-code rotation claim the TOTP timestep transactionally;
- generic Admin audit stores an exact redacted old snapshot and the actual
  returned after-state. These are covered by auth, concurrency and audit tests.

## STAB-037 — Expired idempotency response payloads were retained indefinitely

- Severity: HIGH
- Category: security, performance, privacy
- Module: Admin POST idempotency
- Status: FIXED
- Recheck count: 2
- Evidence: a record was removed only when the same derived key was reused;
  unrelated expired response bodies had no retention path.
- Root cause: logical TTL was checked during replay but not enforced as storage
  lifecycle.
- Selected solution: every 16 idempotent operations attempts a separate,
  index-backed 250-row `SKIP LOCKED` delete. Failure is logged and does not fail
  the business request.
- Regression: unrelated expired payload is reclaimed while an active record and
  new requests remain available.

## STAB-038 — Restricted production smoke could execute stale build output

- Severity: HIGH
- Category: testing, CI, production readiness
- Module: runtime-role smoke
- Status: FIXED
- Recheck count: 2
- Evidence: the script launched `dist` without building and CI did not execute
  it.
- Selected solution: `pnpm test:runtime-role` builds first, allocates an
  ephemeral port, redacts bounded child diagnostics and is a CI step after
  migration/E2E/OpenAPI gates.
- Regression: clean gate executes current build under a real restricted login
  and performs allowed domain SELECT/INSERT/UPDATE, proves destructive
  DELETE/TRUNCATE/ALTER and migration-history reads fail, then observes health
  200, anonymous Admin 401 and production Swagger 404.

# AI change log

## 2026-07-24 — Public release program started

- Restored state from delivery/stabilization reports and Graphify.
- Read the attached independent-stabilization mandate.
- Registered the new six-stage public-release scope.
- Recorded the intentional scope supersession that now authorizes auth, Public
  API and CMS while retaining the ranking and competition-registration limits.
- No backend code or database schema changed in this entry.

## 2026-07-24 — Stage 1 contract implementation

- Added fail-closed exact-origin CORS configuration and tests.
- Added typed resource OpenAPI components and envelopes.
- Made nested identifier lists follow the standard pagination contract.
- Added the frontend API matrix and OpenAPI export command/snapshot.
- Passed 67 unit tests, 36 E2E tests and build on a clean audit database.
- Refreshed Graphify after architecture/contract changes.
- Independent Stage 1 review is pending; Stage 1 is not marked GO yet.

## 2026-07-24 — Stage 1 independent review

- Reviewer rejected GO with two confirmed contract HIGH findings and one CI
  gate HIGH.
- Stage 1 reopened; no release status was overstated.

## 2026-07-24 — Stage 1 contract remediation

- Replaced empty Swagger `Object` fallbacks with explicit scalar request and
  query metadata.
- Added typed detail/list relation projections, UUID path formats and 413
  responses to the generated OpenAPI contract.
- Added production HTTPS enforcement for CORS origins.
- Added runtime pagination regression coverage for nested identifiers.
- Added deterministic OpenAPI snapshot and SHA-256 verification to CI.
- Passed 68 unit, 20 database and 40 E2E tests plus lint, typecheck,
  Prisma validation/generation, OpenAPI check and build on Node 22.
- Refreshed Graphify to 1,599 nodes, 2,940 edges and 102 communities.
- Requested the second independent review; Stage 1 remains open pending its
  verdict.

## 2026-07-24 — Stage 1 strict GO

- Corrected the final nested result projection mismatch and added a live
  contract regression.
- Final authoritative Node 22 gate passed 68 unit, 20 database and 41 E2E
  tests, plus lint, typecheck, OpenAPI check and build.
- Independent Senior Review returned `STRICT GO` for Frontend Integration
  Readiness.
- Public exposure remains prohibited until Admin Protection is complete.

## 2026-07-24 — Stage 2 Admin Protection candidate

- Moved the domain surface to `/api/v1/admin/*` and added opaque
  PostgreSQL-backed Admin sessions with Argon2id, TOTP/recovery 2FA, lockout,
  rotation, revocation and re-enrollment.
- Added persisted permission mappings and separate Admin read/write, audit-read
  and own-security checks.
- Added CSRF, exact credentialed CORS, Helmet, proxy/HSTS controls and protected
  production Swagger.
- Added PostgreSQL-backed multi-instance rate limits.
- Added transaction-atomic, redacted, append-only audit.
- Added mandatory Admin POST idempotency and numeric PATCH optimistic versions.
- Closed recovery/TOTP/password concurrency races with single-use transactional
  factor claims.
- Added ten additive security/integrity migrations after the original
  database baseline; no historical migration was rewritten.
- Added targeted auth, lifecycle, hardening, permission, throttle, audit,
  idempotency and concurrency regressions.
- Stage 2 remains open pending the clean full gate and independent review.

## 2026-07-24 — Stage 2 clean local gate

- Created isolated local `fem_audit_release_stage2` without altering any
  existing database.
- Applied the then-current ten migrations from empty PostgreSQL and ran demo
  seed three times
  with stable counts.
- Passed lint, typecheck, 69 unit, 22 database and 63 E2E tests.
- Passed build, OpenAPI export/check (71 paths, 97 operations, 126 schemas) and
  compiled runtime smoke.
- Refreshed Graphify to 1,886 nodes, 3,730 edges and 130 communities; no import
  cycle was detected.
- Stage 2 remains open until both independent reviews are reconciled.

## 2026-07-24 — Stage 2 independent-review remediation

- Corrected rate-limit storage so an active `blockedUntil` survives expiry of
  the original counting window; added an HTTP regression.
- Added a separate `VERSION_OVERRIDE` permission for confirmed
  `If-Match: *` operations and a negative authorization regression.
- Added a migration-owned NOLOGIN `fem_runtime` capability role, revoked
  schema DDL and AuditLog mutation rights, and made production startup reject
  privileged runtime credentials.
- Added a real restricted-login database test proving ordinary DML while
  rejecting AuditLog mutation, trigger disable and trigger drop.
- Three additional additive migrations bring the current chain to thirteen.
- A clean 13-migration replay, seed x3, 69 unit, 24 DB, 66 E2E, build, OpenAPI
  and restricted production runtime smoke passed.
- Stage 2 remains open pending renewed independent review.

## 2026-07-24 — Stage 2 second independent-review remediation

- Removed the unsafe intermediate blanket database-role grant from the
  unpublished migration chain; the first role migration now creates only the
  final database-scoped explicit privilege matrix.
- Production startup now rejects dangerous login attributes, any unexpected
  membership, direct excess grants, capability ownership and default ACLs.
- Added adversarial partial-migration, ownership/default-ACL and complete table
  privilege-matrix coverage.
- Bounded rate-limit cleanup to 500 rows with `SKIP LOCKED`, failure isolation
  and a 750-row two-instance regression.
- Added bounded idempotency payload retention and active/expired record tests.
- Enforced current-source build plus restricted production runtime smoke in CI
  with an ephemeral port.
- Clean `fem_audit_release_stage2_gate3` evidence: 13 migrations, seed x3,
  69 unit, 25 DB and 67 E2E tests, OpenAPI and production runtime smoke.
- Refreshed Graphify to 1,911 nodes, 3,785 edges and 132 communities.

## 2026-07-24 — Stage 2 strict GO

- Replaced the unpublished runtime-role draft with a database-scoped,
  explicit least-privilege capability and fail-closed production startup.
- Added exact membership options, complete table/column ACL and grant-option
  checks, PUBLIC/system ACL provenance, ownership/default-ACL, dangerous-GUC
  and cross-database isolation checks.
- Added adversarial regressions for missing/excess/direct/PUBLIC ACL,
  migration-history views, system functions/catalogs, parameter privileges,
  object ownership and adjacent databases.
- Final clean `fem_audit_release_stage2_gate5` evidence: 13 migrations,
  seed x3, lint/typecheck, 69 unit, 25 DB, 67 E2E, OpenAPI check, build and
  restricted compiled runtime smoke.
- Three independent strict reviewers reported zero open
  BLOCKER/CRITICAL/HIGH. Stage 2 is closed; work moved directly to Stage 3.

## 2026-07-24 — Public API hardening and clean gate

- Added separate locale-scoped Public projections for countries, disciplines,
  clubs, athletes, horses, competitions, classes and results.
- Added explicit publish/withdraw workflows for public profiles, events and
  results; demo rows cannot be published and dependency closure fails closed.
- Added profile publication constraints/indexes, ResultMetric demo-boundary
  trigger, trigram search indexes and restricted function privileges.
- Public responses use ETag with mandatory revalidation; errors use
  `no-store`; lists use `REPEATABLE READ`.
- Clean `fem_audit_release_stage3_gate4` evidence: 17 migrations, seed x3,
  lint/typecheck, 69 unit, 27 DB and 84 E2E tests, OpenAPI check, build,
  runtime-role smoke and guarded performance audit.

## 2026-07-24 — DB-first demo documentation baseline

- Integrated the package from `Downloads/new dock` according to
  `DOCS_REPLACEMENT_MAP.md`.
- Added `FEM_MVP_ACCELERATED_PLAN.md` version 3.0 and replaced the active
  acceptance, delivery and progress documents without deleting historical
  stabilization/database evidence.
- Reconciled package claims with current code: the Public API already exists
  and remains regression-tested, but it is not expanded or consumed by the
  first protected demo-web.
- Updated current quality/session/handoff facts to the latest Node 22 clean
  gate instead of retaining the package's stale Node 24/10-migration baseline.
- Removed two non-canonical duplicate documents from `docs/`; the root plan and
  replacement map remain the single sources of truth.
- Refreshed Graphify with deletion pruning to 2130 nodes, 4464 edges and 137
  communities; stale duplicate document nodes are absent.
- Re-ran the docs-only regression gate on Node 22.23.1: lint, strict typecheck,
  9 unit suites / 69 tests and production build all pass.

## 2026-07-24 — DB-first demo Stage 0 and Stage 1

- Accepted `FEM_MVP_ACCELERATED_PLAN.md` 3.0 as the active scope.
- Fixed provisional RU language, fictional demo-data policy, visible columns,
  minimal forms, four explicitly demo categories and a safe competition venue
  update without representing them as official FEM decisions.
- Mapped every demo step to one of seven frontend routes and the protected
  Admin API; no dashboard, owners, CMS or Public API route was added.
- Stage 0 contract gate passed.
- Stage 1 Node 22.23.1 gate passed: Prisma validate/generate, lint, strict
  typecheck, 9 unit suites / 69 tests and production build.

## 2026-07-24 — DB-first demo Stage 2 and Stage 3

- Applied all 17 migrations from empty PostgreSQL 16 to isolated local
  `fem_audit_demo_stage2_20260724223427`; no development database was reset.
- Expanded the repeatable presentation seed to 4 clubs, 16 fictional athletes,
  16 fictional horses, 12 classes and 60 linked results with four provisional
  categories and three levels.
- Added internal demo identifiers under `FEM_DEMO/DEMO_RECORD_CODE` without
  generating FEI, passport or microchip identifiers.
- Added batched Athlete `currentClubs`/`primaryIdentifier`, Horse
  `primaryIdentifier`, and bounded Horse detail result/identifier projections.
- Added explicit OpenAPI `AthleteListItem` and `HorseListItem` schemas and
  generated `api-client/generated/schema.d.ts` with CI drift verification.
- Stabilized test tooling, Prisma P2034 recognition/backoff and PostgreSQL
  rate-limit contention with per-bucket transaction advisory locks.
- Final gate passed: Prisma format/validate/generate, lint, typecheck, 10 unit
  suites / 70 tests, 2 DB suites / 28 tests, 12 E2E suites / 85 tests, OpenAPI
  check, generated types check, restricted runtime-role smoke and build.
- Этапы 0–3 завершены со статусом PASS. Frontend не создавался; следующая
  разрешённая работа — Этап 4.

## 2026-07-24 — DB-first demo Stage 4–7

- Added one scoped React/Vite workspace at `apps/demo-web`; no dashboard,
  public website, CMS, Excel, ranking, owners UI or standalone class/result
  pages were created.
- Implemented protected login/shell and seven routes for athletes, horses and
  competitions, with classes/categories and results embedded in the
  competition workspace.
- Added OpenAPI-derived consumer types, credentialed API client, CSRF,
  `Idempotency-Key`, `If-Match`, server-side pagination/filter/sort, URL state,
  semantic tables and safe loading/empty/error/not-found UI.
- Extended the existing CI gate with demo-web lint, strict typecheck, tests and
  production build after the frozen workspace install.
- Fixed three integration defects found during browser review: cross-host
  SameSite cookie mismatch, unsupported nested sort parameters and lookup
  status filtering that rejected countries or hid demo DRAFT references.
- Verified a safe competition venue update against the real Admin API and
  isolated demo/audit DB; no Prisma schema or migration was changed.
- Final backend gate: 70 unit, 28 DB and 85 E2E tests plus Prisma,
  lint/typecheck/OpenAPI/build PASS.
- Final demo-web gate: 11 tests, lint/typecheck/build PASS; browser QA covered
  login, seven routes, direct links, Back/Forward, 404/requestId, pagination
  limits 1/100 and 1280/390 layouts.
- Stages 4–6: PASS. Stage 7 local production preview: PASS. External HTTPS
  preview: CONDITIONAL because hosting/DNS/TLS/secret access is not available.

## 2026-07-25 — FEM login visual redesign

- Rebuilt `/login` as a responsive FEM-branded landing/auth composition while
  preserving the existing email, password, TOTP, session and redirect flow.
- Added a locally bundled variable Nunito font, accessible labels, a skip link,
  password visibility control, busy/error states and reduced-motion support.
- Kept unsupported registration and social-login actions out of the interface.
- Added focused component tests for the auth payload, password visibility and
  safe error rendering; demo-web gate now passes 4 files / 17 tests.
- Corrected the desktop grid minimum that could push the auth card beyond the
  viewport. DOM QA confirms no horizontal document overflow at the default
  desktop viewport.

## 2026-07-25 — Demo-web rendering and loading optimization

- Split AppShell, registry lists and detail pages into route-level lazy chunks;
  the login route no longer evaluates every protected page on first load.
- Reduced initial JavaScript from 300.25 kB to 250.84 kB before gzip, with
  protected route chunks loaded only when required.
- Replaced continuous decorative animation, large blur filters and
  backdrop-filter layers with visually equivalent static gradients and
  shadows.
- Limited bundled Nunito assets to the Cyrillic, Latin and Latin Extended
  subsets required by the RU/RO interface.
- Re-ran lint, strict typecheck, 17 component tests and production build; all
  checks pass. Live browser verification reports no overflow or console errors.

## 2026-07-25 — Admin visual system redesign

- Preserved the existing sidebar/workspace structure, routes, tables, filters,
  forms, drawers and API behavior.
- Replaced the previous Georgia/Inter and square navy UI with a shared
  Nunito-based sky/coral system matching the optimized login experience.
- Restyled navigation, topbar, demo notice, page headings, controls, data
  tables, status badges, detail cards, competition workspace and form drawers.
- Corrected the intermediate sidebar breakpoint so the wordmark is hidden
  cleanly while the navigation remains readable in a 12.5rem rail.
- Replaced the compact navigation codes `01 / 02 / 03` with the readable
  section names `Спортсмены / Лошади / Соревнования` and added a regression
  test for the navigation contract.
- Simplified the sidebar logo to an unframed white `FEM` wordmark with no
  gradient tile, border or shadow.
- Reworked the login identity around the title `База данных конного спорта
Молдовы`, added a consistent horse-head silhouette and removed visible
  prototype/demo labels from login, application chrome, forms and metadata.
- Kept all ambient effects static: the only remaining CSS animation is the
  bounded loading spinner.
- Verified frontend lint, strict typecheck, 17 tests and production build.

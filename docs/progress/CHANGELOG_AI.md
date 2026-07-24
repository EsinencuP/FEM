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

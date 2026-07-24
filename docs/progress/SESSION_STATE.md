# FEM backend session state

Updated: 2026-07-24

## Goal

Bring the backend to an evidence-based `PUBLIC-RELEASE-READY` state without
building frontend code.

## Restored baseline

- Database and private MVP API stabilization completed four audit cycles.
- Three clean local gates passed migrations, seed x3, unit, DB, E2E, build,
  performance smoke and compiled HTTP smoke.
- Current evidence score is 7.3/10.
- Public deployment remains `NO-GO`.
- Graphify 0.9.25 graph exists in `graphify-out/`; the CLI is available at
  `C:\Users\User.DESKTOP\.local\bin\graphify.exe` but is not in the current
  PowerShell `PATH`.
- Project-scoped Graphify skill is referenced by the graph but
  `.agents/skills/graphify/SKILL.md` is not present in the current checkout.

## Confirmed release blockers

- no Public/Admin API separation;
- no authentication, session lifecycle, 2FA or RBAC;
- no atomic application audit writer;
- no rate limiting or production CORS allowlist;
- OpenAPI success envelopes do not expose resource properties;
- no CMS for news, pages, navigation, localized SEO or revisions;
- no public allowlist projections;
- external staging/UAT/backup/restore/monitoring evidence is not yet available.

## Scope decision

The latest user instruction explicitly authorizes and requires authentication,
roles, 2FA, Public API and CMS. It supersedes the earlier stabilization-only
scope that prohibited those product modules. Official ranking calculation and
competition registration remain excluded.

## Current stage

Stage 2 — Admin Protection: in progress after Stage 1 received an independent
**STRICT GO**.

## Stage 1 implemented

- validated exact-origin `CORS_ALLOWED_ORIGINS`; wildcard rejected, production
  fails closed when empty, and production browser origins require HTTPS;
- resource-specific OpenAPI components and response envelopes;
- detail and list relation projections documented for generated clients;
- UUID path formats and 413 payload-limit responses documented;
- paginated nested external identifier collections;
- `docs/delivery/FRONTEND_API_MATRIX.md`;
- reproducible `pnpm openapi:export` snapshot and SHA-256 at
  `api-client/openapi/`, enforced by `pnpm openapi:check` in CI;
- Graphify refreshed to 1,599 nodes, 2,940 edges and 102 communities.

## Stage 1 evidence

- migrations applied to clean `fem_audit_release_stage1`;
- demo seed executed twice with stable counts;
- database: 1 suite / 20 tests passed;
- unit: 9 suites / 68 tests passed;
- E2E: 4 suites / 40 tests passed;
- OpenAPI: 85 operations, zero empty `Object` request/query references;
- lint, typecheck, OpenAPI snapshot/checksum check and build passed on Node 22.

## Independent Stage 1 remediation

- empty `Object` request/query schemas corrected and regression-tested;
- runtime list selects and documented required fields aligned;
- detail and list relation projections added after the reviewer found generated
  clients could not type actual detail payloads;
- all non-slug path parameters marked as UUID;
- standard 413 error response documented;
- nested identifiers pagination receives runtime E2E coverage;
- snapshot/checksum verification added to CI;
- frontend matrix query names and sort allowlists aligned with code.

The second independent review confirmed the corrected implementation and
contract evidence. Stage 1 is closed with `STRICT GO`; this is scope-limited and
does not authorize public exposure before Stage 2.

Two intentionally rejected database names proved the seed guard fails closed:
`fem_release_stage1` and `fem_test_release_stage1`. They contain baseline
migrations only and were not seeded or used for mutating tests.

# MVP Database Audit Report

- Date: 2026-07-22
- PostgreSQL: 16
- Prisma: 6.19.3
- Verdict: ready for MVP CRUD API development, subject to the open governance questions

## Actual state

The schema contains 30 application tables across system/governance, references, sport, competition/results and ranking storage. All primary keys are native UUIDs. Official identifiers are non-generated records in `ExternalIdentifier`. Competition storage is strictly event → class → result; no entry, application, registration, payment, start-list or live-scoring table exists. Ranking tables store versioned snapshots and evidence but implement no official formula.

## Findings and corrections

| Finding                                                                                                                                                                                               | Correction                                                 | Migration                                   | Risk                                                                               | Proof                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Approval actor used `SET NULL` while SQL required `approvedAt` and `approvedById` to be both null or both present. Actor deletion could fail indirectly or erase evidence if the check were weakened. | Both approval FKs now use explicit `RESTRICT`.             | `20260722204033_mvp_database_stabilization` | Low; actor hard-delete now predictably requires prior audited approval revocation. | Integration test rejects actor deletion while approval exists. |
| Four confirmed MVP list/filter paths lacked leading indexes.                                                                                                                                          | Added name/display-name, birth-year and event-end indexes. | same                                        | Low write/storage overhead; review after representative query plans.               | Catalog contains all four indexes.                             |
| Required integrity suite did not explicitly cover athlete–horse history or horse/event archive retention.                                                                                             | Added focused PostgreSQL integration scenarios.            | none                                        | Test-only.                                                                         | 16/16 DB constraint tests pass.                                |

## Integrity assessment

- UUID primary keys and FK types are consistent.
- Exact external identifier tuple is permanently unique, including archived rows.
- Temporal tables require `startDate`; nullable `endDate` means an open interval; SQL rejects end-before-start.
- No `isCurrent` column can diverge from interval dates. Overlap and multiple current relations remain allowed because Federation rules are unknown.
- Result requires a class, athlete and horse. Rank remains nullable for status-only results.
- Archive operations do not remove results. No delete cascade exists.
- Polymorphic targets (`ExternalIdentifier`, `AuditLog`, `ImportRow`) remain application-enforced and are an explicit limitation.

## Verification results

- frozen install: passed;
- Docker healthcheck/persistent volume: passed;
- Prisma format/validate/generate: passed;
- migration deploy on empty DB: passed;
- migrations/schema drift: none;
- seed run 1 and run 2: identical counts (`5/1/3/3/10/12/5/3/8/36/1` for countries/federations/disciplines/clubs/athletes/horses/owners/events/classes/results/snapshots);
- database constraint integration tests: 16 passed;
- lint: passed;
- TypeScript strict typecheck: passed;
- unit tests: 6 passed;
- database constraint integration tests: 16 passed;
- HTTP E2E: 1 passed;
- production build: passed;
- live `/api/health`: `status=ok`, `database=connected`;
- Swagger UI/OpenAPI JSON: HTTP 200 and `/api/health` present;
- Prisma Studio: opened successfully; `CompetitionResult`, `AthleteHorseRelation` and draft demo `RankingSnapshot` relationships were inspected.

## Remaining risks

Official vocabularies, identifier normalization by issuer, temporal overlap/multiplicity, privacy/retention, publication authority and ranking rules remain provisional. B-tree name indexes do not support arbitrary substring, accent-insensitive or multilingual search. No production migration or deployment was attempted.

# MVP Database Baseline

- Baseline date: 2026-07-22
- Baseline migration: `20260722204033_mvp_database_stabilization`
- Migration SQL SHA-256: `8279CB1BE58C9BD64D1D016A911BE33A6B512C8D4F397248C0DE3C4734E7C6D6`
- Predecessor: `20260722201238_initial_database_v1`
- Schema/migration drift: none

> Historical domain baseline note: Release Program Stage 2 adds seven
> security/reliability tables (`UserCredential`, `AdminSession`,
> `AdminRecoveryCode`, `RateLimitBucket`, `IdempotencyRecord`, `Permission`,
> `RolePermission`) and optimistic `version` columns through separate additive
> migrations. The domain model and ranking boundaries in this document are not
> reinterpreted. Current security details are in
> `docs/delivery/ADMIN_API_SECURITY.md`.

## Approved models and tables

System/governance: `User`, `Role`, `UserRole`, `AuditLog`, `ImportBatch`, `ImportRow`, `MediaFile`, `Document`, `ExternalIdentifier`.

References: `Country`, `NationalFederation`, `Discipline`, `Club`, `ResultStatus`.

Sport: `Athlete`, `Horse`, `Owner`, `AthleteClubMembership`, `AthleteHorseRelation`, `HorseOwnership`.

Competitions: `CompetitionEvent`, `CompetitionClass`, `CompetitionResult`, `ResultMetric`.

Rankings: `RankingDefinition`, `RankingRuleSet`, `RankingPeriod`, `RankingSnapshot`, `RankingEntry`, `RankingEntryResult`.

The domain baseline contains 30 application tables. The current Stage 2 schema
contains 37 application/technical tables. `_prisma_migrations` is Prisma
infrastructure and is not an application model.

## Key relationships

- event → class → result is mandatory and restrictive;
- every result references an athlete and horse; rank may be null;
- athlete–club, athlete–horse and horse–owner histories use dated rows;
- ranking snapshots are immutable-by-service revisions and retain result evidence;
- official/external identifiers are separate from UUIDs and use application-enforced polymorphic targets.

## Provisional nullable fields

Examples include athlete birth/gender/country/federation, horse passport name/birth details/sex/breed/color/studbook/country, club legal name/federation, relationship types/shares, event descriptive/location fields, class category/level/date, numeric result fields and ranking configuration/points. Their complete field-level classification is in `DATA_DICTIONARY.md` and `ENTITY_MATRIX.md`.

## Known limitations and open questions

- No database FK can validate generic polymorphic targets in v1.
- Cross-table demo-boundary consistency and several ranking compatibility rules are service-enforced.
- Temporal overlaps are permitted; no unconfirmed one-current-club/rider/owner rule exists.
- Official result codes, identifiers, publications and ranking formula are not defined.
- Privacy, legal erasure, actor anonymization and production retention are unresolved.
- Name search beyond stable B-tree ordering requires measured API requirements.

`OPEN_QUESTIONS.md` is normative for unresolved business and governance decisions. This baseline authorizes CRUD API implementation only after service-level validation, transaction and audit rules are designed; it does not authorize auth, frontend, registration or official ranking calculation.

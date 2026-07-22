# Database v1 Index Strategy

- Status: quality-review recommendation
- Target: PostgreSQL 16 / Prisma 6
- Rule: index confirmed query paths and integrity keys first; add search/reporting indexes only after `EXPLAIN (ANALYZE, BUFFERS)` on representative data

## Principles

1. PostgreSQL automatically indexes primary keys and unique constraints. Do not duplicate their leading columns with another identical index.
2. PostgreSQL does not automatically index referencing FK columns. Add indexes for delete checks and frequent joins.
3. Composite index order follows equality filters, then range/order fields, then a stable UUID tie-breaker when useful.
4. Partial indexes are used for clearly stable predicates such as open unarchived temporal rows or ranking subject shape.
5. Do not use `archivedAt` alone as a general index; low-cardinality/null-heavy columns are useful when combined with real filters or as a partial predicate.
6. `isDemo` is not an isolation/security mechanism. Index it only inside a demonstrated mixed-dataset query path.
7. Prisma schema cannot represent PostgreSQL partial indexes, `NULLS NOT DISTINCT` uniqueness or all checks. Keep those statements in the migration and document them here.
8. Names below are logical recommendations. The Lead must match exact generated quoted identifiers before applying SQL.

## Integrity and unique indexes

| Table                   | Key/predicate                                                                    | Purpose                                          | Mechanism                                                              |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `User`                  | `email`                                                                          | normalized technical identity                    | Prisma unique                                                          |
| `Role`                  | `code`                                                                           | stable internal role key                         | Prisma unique                                                          |
| `UserRole`              | `(userId, roleId) WHERE endDate IS NULL AND archivedAt IS NULL`                  | one exact active role assignment                 | manual partial unique                                                  |
| `Country`               | `isoAlpha2`; `isoAlpha3`                                                         | ISO keys                                         | Prisma unique                                                          |
| `Discipline`            | `code`                                                                           | stable technical discipline key                  | Prisma unique                                                          |
| `MediaFile`             | `storageKey`                                                                     | storage locator                                  | Prisma unique                                                          |
| `ImportRow`             | `(importBatchId, rowNumber)`                                                     | row idempotency inside batch                     | Prisma compound unique                                                 |
| `ExternalIdentifier`    | `(namespace, identifierType, normalizedValue)`                                   | permanent official/external collision protection | Prisma compound unique                                                 |
| `AthleteClubMembership` | `(athleteId, clubId, startDate, membershipType) NULLS NOT DISTINCT`              | exact temporal duplicate protection              | manual unique index                                                    |
| `AthleteHorseRelation`  | `(athleteId, horseId, relationType, startDate, disciplineId) NULLS NOT DISTINCT` | exact temporal duplicate protection              | manual unique index                                                    |
| `HorseOwnership`        | `(horseId, ownerId, startDate)`                                                  | exact temporal duplicate protection              | Prisma compound unique                                                 |
| `CompetitionEvent`      | `slug`                                                                           | routing key                                      | Prisma unique                                                          |
| `ResultStatus`          | `code`                                                                           | normalized status lookup                         | Prisma unique; scope must be revisited if official dictionaries differ |
| `ResultMetric`          | `(competitionResultId, metricCode, sortOrder)`                                   | prevent duplicate metric slot                    | Prisma compound unique                                                 |
| `RankingDefinition`     | `code`                                                                           | technical definition key                         | Prisma unique                                                          |
| `RankingRuleSet`        | `(rankingDefinitionId, version)`                                                 | immutable version key                            | Prisma compound unique                                                 |
| `RankingPeriod`         | `(rankingDefinitionId, code)`                                                    | period key inside definition                     | Prisma compound unique                                                 |
| `RankingSnapshot`       | `(rankingPeriodId, revision)`                                                    | snapshot revision key                            | Prisma compound unique                                                 |
| `RankingEntry`          | per subject shape, see SQL below                                                 | one subject per snapshot                         | three manual partial unique indexes                                    |
| `RankingEntryResult`    | `(rankingEntryId, competitionResultId)`                                          | no double source link in entry                   | Prisma compound unique                                                 |

PostgreSQL 15+ supports `NULLS NOT DISTINCT` on unique indexes. It is preferable to sentinel values for nullable temporal key components because it preserves source nullability.

## Required manual unique indexes

Verify the enum labels and Prisma-generated names before use:

```sql
CREATE UNIQUE INDEX "UserRole_active_user_role_key"
ON "UserRole" ("userId", "roleId")
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE UNIQUE INDEX "AthleteClubMembership_exact_key"
ON "AthleteClubMembership" ("athleteId", "clubId", "startDate", "membershipType")
NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "AthleteHorseRelation_exact_key"
ON "AthleteHorseRelation" (
  "athleteId", "horseId", "relationType", "startDate", "disciplineId"
)
NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "RankingEntry_snapshot_athlete_key"
ON "RankingEntry" ("rankingSnapshotId", "athleteId")
WHERE "subjectType" = 'ATHLETE';

CREATE UNIQUE INDEX "RankingEntry_snapshot_horse_key"
ON "RankingEntry" ("rankingSnapshotId", "horseId")
WHERE "subjectType" = 'HORSE';

CREATE UNIQUE INDEX "RankingEntry_snapshot_pair_key"
ON "RankingEntry" ("rankingSnapshotId", "athleteId", "horseId")
WHERE "subjectType" = 'ATHLETE_HORSE_PAIR';
```

These indexes are not a substitute for subject-shape checks. If the final Prisma mapping uses snake_case or differently named enum values, use the generated database names instead of copying this template blindly.

## System and governance indexes

| Table                | Recommended index                                        | Query                                    |
| -------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `User`               | `(status, archivedAt)`                                   | internal active-user list                |
| `UserRole`           | `(userId, startDate DESC, endDate)`; `(roleId, endDate)` | role history and current assignees       |
| `AuditLog`           | `(entityType, entityId, createdAt DESC)`                 | entity audit timeline                    |
| `AuditLog`           | `(actorId, createdAt DESC)`                              | actor review                             |
| `AuditLog`           | `(requestId)`                                            | request correlation; nullable non-unique |
| `ImportBatch`        | `(status, createdAt DESC)`                               | processing/review queue                  |
| `ImportBatch`        | `(checksum, sourceType, entityType, createdAt DESC)`     | repeated-file detection                  |
| `ImportRow`          | `(importBatchId, status, rowNumber)`                     | batch outcome pages                      |
| `ImportRow`          | `(linkedEntityType, linkedEntityId)`                     | entity import provenance                 |
| `MediaFile`          | `(checksum)`                                             | duplicate candidate lookup, non-unique   |
| `Document`           | `(publicationStatus, archivedAt, createdAt DESC)`        | document workflow/list                   |
| `Document`           | `(mediaFileId)`                                          | media provenance/delete check            |
| `ExternalIdentifier` | `(entityType, entityId, archivedAt)`                     | identifiers for entity                   |
| `ExternalIdentifier` | `(identifierType, normalizedValue)`                      | duplicate/search review                  |
| `ExternalIdentifier` | `(verificationStatus, archivedAt, createdAt)`            | verification queue                       |
| `ExternalIdentifier` | `(sourceDocumentId)`; `(verifiedById)`                   | provenance and FK operations             |

Do not add a partial unique `isPrimary` index until the Federation/display policy confirms one current primary identifier per scope.

## Reference and domain indexes

| Table                | Recommended index                         | Query                            |
| -------------------- | ----------------------------------------- | -------------------------------- |
| `NationalFederation` | `(countryId, archivedAt)`                 | federation by country            |
| `Club`               | `(countryId, status, archivedAt)`         | country/status list              |
| `Club`               | `(nationalFederationId, archivedAt)`      | federation clubs                 |
| `Athlete`            | `(lastName, firstName, id)`               | stable directory order           |
| `Athlete`            | `(countryId, status, archivedAt)`         | filtered directory               |
| `Athlete`            | `(nationalFederationId, archivedAt)`      | federation athletes              |
| `Horse`              | `(displayName, id)`; `(passportName, id)` | stable equality/prefix directory |
| `Horse`              | `(countryOfBirthId, status, archivedAt)`  | country/status filter            |
| `Owner`              | `(displayName, id)`                       | internal ordered lookup          |
| `Owner`              | `(countryId, archivedAt)`                 | country filter                   |

Avoid separate low-value indexes on every status, boolean or archive field. At production-like volume, verify selectivity and query plans.

## Temporal history indexes

General history indexes:

- `AthleteClubMembership(athleteId, startDate DESC, endDate)`;
- `AthleteClubMembership(clubId, startDate DESC, endDate)`;
- `AthleteHorseRelation(athleteId, startDate DESC, endDate)`;
- `AthleteHorseRelation(horseId, startDate DESC, endDate)`;
- `AthleteHorseRelation(disciplineId, endDate)`;
- `HorseOwnership(horseId, startDate DESC, endDate)`;
- `HorseOwnership(ownerId, startDate DESC, endDate)`.

Current-relation partial indexes are worthwhile because the predicate is stable and common:

```sql
CREATE INDEX "AthleteClubMembership_current_athlete_idx"
ON "AthleteClubMembership" ("athleteId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "AthleteClubMembership_current_club_idx"
ON "AthleteClubMembership" ("clubId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "AthleteHorseRelation_current_athlete_idx"
ON "AthleteHorseRelation" ("athleteId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "AthleteHorseRelation_current_horse_idx"
ON "AthleteHorseRelation" ("horseId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "HorseOwnership_current_horse_idx"
ON "HorseOwnership" ("horseId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "HorseOwnership_current_owner_idx"
ON "HorseOwnership" ("ownerId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;
```

Do not add overlap-exclusion indexes until the simultaneous-relation rules are confirmed.

## Competition and result indexes

| Table               | Recommended index                                    | Query                       |
| ------------------- | ---------------------------------------------------- | --------------------------- |
| `CompetitionEvent`  | `(publicationStatus, startDate DESC, id)`            | public/editorial event list |
| `CompetitionEvent`  | `(countryId, startDate DESC, id)`                    | country calendar            |
| `CompetitionEvent`  | `(status, startDate DESC)`                           | internal workflow           |
| `CompetitionClass`  | `(competitionEventId, sortOrder, id)`                | event page                  |
| `CompetitionClass`  | `(disciplineId, competitionDate, id)`                | discipline/date list        |
| `CompetitionClass`  | `(competitionEventId, status)`                       | editorial filter            |
| `CompetitionResult` | `(competitionClassId, publicationStatus, rank, id)`  | class result table          |
| `CompetitionResult` | `(athleteId, publicationStatus, createdAt DESC, id)` | athlete result history      |
| `CompetitionResult` | `(horseId, publicationStatus, createdAt DESC, id)`   | horse result history        |
| `CompetitionResult` | `(statusId, publicationStatus)`                      | status filter               |
| `CompetitionResult` | `(sourceDocumentId)`                                 | provenance/FK operation     |
| `ResultMetric`      | `(competitionResultId, sortOrder, id)`               | ordered metric load         |

The class result index must be tested with explicit PostgreSQL null ordering. Do not rely on B-tree order alone for the unresolved rule placing unranked/status-only rows.

## Ranking indexes

| Table                | Recommended index                                                      | Query                              |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| `RankingDefinition`  | `(disciplineId, subjectType, status, archivedAt)`                      | definition catalog                 |
| `RankingRuleSet`     | `(rankingDefinitionId, status, archivedAt)`                            | version/workflow list              |
| `RankingRuleSet`     | `(sourceDocumentId)`; `(approvedById)`                                 | provenance                         |
| `RankingPeriod`      | `(rankingDefinitionId, startDate, endDate)`                            | period lookup                      |
| `RankingPeriod`      | `(status, archivedAt)`                                                 | workflow list                      |
| `RankingSnapshot`    | `(rankingPeriodId, publicationStatus, snapshotAt DESC, revision DESC)` | snapshot history/current candidate |
| `RankingSnapshot`    | `(calculationStatus, createdAt)`                                       | processing queue                   |
| `RankingSnapshot`    | `(supersedesSnapshotId)`; `(comparisonSnapshotId)`                     | graph lookup/FK operation          |
| `RankingEntry`       | `(rankingSnapshotId, rank, id)`                                        | stable ranking table               |
| `RankingEntry`       | `(athleteId, rankingSnapshotId)`                                       | athlete history                    |
| `RankingEntry`       | `(horseId, rankingSnapshotId)`                                         | horse history                      |
| `RankingEntryResult` | `(rankingEntryId, isCounted, sortOrder, id)`                           | counted/dropped breakdown          |
| `RankingEntryResult` | `(competitionResultId)`                                                | result impact/provenance           |

Do not add a unique rank index. Do not add a generic `subjectType, rank` index until a measured query needs it.

## Deferred search/index features

The following require confirmed API behavior and measured data volume:

- `pg_trgm` for contains/fuzzy person, horse, club or event search;
- full-text indexes and language configurations;
- accent/case-insensitive expression indexes;
- GIN indexes on import/audit/ranking JSONB;
- BRIN indexes on very large append-only audit/import tables;
- covering indexes with `INCLUDE`;
- partitioning of audit/import/results/snapshots.

JSONB GIN indexes are specifically rejected for v1 unless a stable containment query is implemented. Unindexed raw import JSON should not be exposed as a general search API.

## Verification after migration

1. Query `pg_indexes` and compare the result with this document and Prisma schema.
2. Verify every FK's child columns have a useful index, except deliberately tiny/reference-only paths.
3. Confirm no duplicate automatically generated/manual indexes.
4. Run `EXPLAIN (ANALYZE, BUFFERS)` against seeded list, history and provenance queries.
5. Verify partial predicates and enum literals exactly match the stored values.
6. Re-run all uniqueness and constraint integration tests on PostgreSQL 16.

# Database v1 + Admin Security Data Dictionary

- Status: Database v1 audited; Stage 2 security extension gate pending
- Latest migration: `20260724104500_admin_permissions`
- PostgreSQL: 16
- ORM: Prisma 6
- Legend: `R` required, `N` nullable, `U` unique, `P` provisional semantics

All `id` fields are internal UUID primary keys. Unless noted, mutable entities include `createdAt timestamptz`, `updatedAt timestamptz`; archived entities include nullable `archivedAt timestamptz`. Admin-mutable domain entities additionally expose positive integer `version` for optimistic concurrency. Calendar dates use PostgreSQL `date`. Official/external numbers are stored only in `ExternalIdentifier` and never generated.

## Internal enums

| Enum                       | Values                                                              | Meaning                                   |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| `RecordStatus`             | `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`                           | internal lifecycle, not a Federation code |
| `PublicationStatus`        | `DRAFT`, `PUBLISHED`, `WITHDRAWN`                                   | explicit visibility state                 |
| `VerificationStatus`       | `UNVERIFIED`, `VERIFIED`, `CONFLICT`, `REJECTED`                    | internal source-review state              |
| `ImportBatchStatus`        | `PENDING`, `PROCESSING`, `COMPLETED`, `PARTIAL`, `FAILED`           | technical import state                    |
| `ImportRowStatus`          | `PENDING`, `VALIDATED`, `IMPORTED`, `SKIPPED`, `CONFLICT`, `FAILED` | technical row state                       |
| `RankingSubjectType`       | `ATHLETE`, `HORSE`, `ATHLETE_HORSE_PAIR`                            | technical subject shape                   |
| `RankingCalculationStatus` | `DRAFT`, `PREPARING`, `FROZEN`, `FAILED`, `SUPERSEDED`              | storage/calculation lifecycle; no formula |

## System and governance

### User

`email` R/U normalized technical email; `displayName` R; `status` R; `isDemo` R; `archivedAt` N; timestamps. Passwords and factors are stored only in the dedicated credential/security tables below.

### Role

`code` R/U normalized technical key; `name` R; `description` N; `isSystem` R; `isDemo` R; `archivedAt` N; timestamps.

### Permission

`code` R/U stable technical key; `name` R; `description` N; `isSystem` R;
`archivedAt` N; timestamps. Stage 2 system values are `ADMIN_READ`,
`ADMIN_WRITE`, `AUDIT_READ`, `SECURITY_SELF` and `VERSION_OVERRIDE`.

### RolePermission

`roleId` R FK; `permissionId` R FK; `createdAt` R. The pair is unique. Both
foreign keys use `RESTRICT`.

### UserRole

`userId` R FK; `roleId` R FK; `startDate` R; `endDate` N/P; `assignedById` N FK; `isDemo` R; `archivedAt` N; timestamps. Exact active assignment has a partial unique index; date order is checked.

### AuditLog

`actorId` N FK; `sessionId` N FK; `action` R; `entityType` R; `entityId` R UUID; `oldData` N JSONB; `newData` N JSONB; `reason` N; `requestId` N; `createdAt` R. PostgreSQL rejects update/delete/truncate; polymorphic target integrity is application-enforced. Secrets and unredacted sensitive data are prohibited.

### UserCredential

`userId` R PK/FK; `passwordHash` R Argon2id; `totpSecretEncrypted` R;
`twoFactorEnabledAt` R; `failedLoginAttempts` R; `lockedUntil` N;
`passwordChangedAt` R; `lastTotpStep` N; timestamps. Plaintext credentials are
never persisted.

### AdminSession

`id` R UUID; `userId` R FK; current and previous token hashes; CSRF token hash;
second-factor method; rotation/pending-re-enrollment timestamps; absolute/idle
expiry; last seen; optional revocation reason, bounded IP and user agent;
timestamps. Token hashes are unique and user deletion is restricted.

### AdminRecoveryCode

`id` R UUID; `userId` R FK; `codeHash` R/U; `usedAt` N; `createdAt` R.

### RateLimitBucket

Technical key R PK; throttler name, window start/expiry, total hits, optional
blocked-until and update timestamp. It contains no credential or request body.

### IdempotencyRecord

Deterministic hash ID R PK; actor/session R FKs; client key, method/path,
request hash, response status/body, expiry and creation timestamp. It is
security/reliability evidence and uses restrictive FKs.

### ImportBatch

`entityType` R; `sourceType` R; `filename` R; `checksum` R; `status` R; `totalRows`, `successRows`, `failedRows` R non-negative; `createdById` N FK; `isDemo` R; `createdAt` R; `completedAt` N. Full importer is not implemented.

### ImportRow

`importBatchId` R FK; `rowNumber` R/U-within-batch positive; `rawData` R JSONB; `normalizedData` N JSONB; `status` R; `errorMessage` N; `linkedEntityType` N; `linkedEntityId` N UUID; `createdAt` R. Link fields are paired; target integrity is application-enforced.

### MediaFile

`storageKey` R/U; `filename` R; `mimeType` R; `sizeBytes` R non-negative bigint; `checksum` N; `altText` N; `credit` N; `status` R; `isDemo` R; `archivedAt` N; timestamps. Stores metadata, not binary data.

### Document

`title` R; `documentType` N/P; `mediaFileId` N FK; `sourceUrl` N; `issuedAt` N; `publicationStatus` R; `isDemo` R; `archivedAt` N; timestamps. Sensitive identity documents are out of scope.

### ExternalIdentifier

`entityType` R; `entityId` R UUID; `identifierType` R; `namespace` R; `value` R; `normalizedValue` R; `normalizationVersion` R; `verificationStatus` R; `isPrimary` R/P; `validFrom`, `validTo` N/P; `sourceDocumentId` N FK; `sourceReference` N; `verifiedById`, `verifiedAt` N; `isDemo` R; `archivedAt` N; timestamps. `(namespace, identifierType, normalizedValue)` is permanently unique. Target integrity is application-enforced.

## Reference data

### Country

`isoAlpha2` R/U uppercase two-letter code; `isoAlpha3` R/U uppercase three-letter code; `name` R; `isDemo` R; `archivedAt` N; timestamps.

### NationalFederation

`countryId` R FK; `name` R; `shortName` N; `websiteUrl` N; `status` R; `isDemo` R; `archivedAt` N; timestamps. Official identity/source remains provisional.

### Discipline

`code` R/U technical key; `name` R; `description` N; `status` R; `isDemo` R; `archivedAt` N; timestamps. Seed codes are visibly demo, not official FEI codes.

### Club

`name` R; `legalName` N/P; `countryId` N/P FK; `nationalFederationId` N/P FK; `status` R; `isDemo` R; `archivedAt` N; timestamps.

### ResultStatus

`code` R/U technical/data-managed key; `label` R; `description` N; `sortOrder` R non-negative; `isRankEligible` N/P; `status` R; `isDemo` R; `archivedAt` N; timestamps. No DNS/DNF/etc. values are treated as official in v1.

## Sport domain

### Athlete

`firstName` R; `lastName` R; `displayName` R; `dateOfBirth` N/P; `gender` N/P; `countryId` N/P FK; `nationalFederationId` N/P FK; `photoId` N FK; `status` R; `isDemo` R; `archivedAt` N; timestamps. No sensitive documents or official ID columns.

### Horse

`passportName` N/P; `displayName` R; `dateOfBirth` N/P; `birthYear` N/P; `sex`, `breed`, `color`, `studbook` N/P; `countryOfBirthId` N/P FK; `imageId` N FK; `status` R; `isDemo` R; `archivedAt` N; timestamps. Date/year consistency is checked. FEI/passport/microchip values are not generated.

### Owner

`displayName` R; `ownerType` N/P; `countryId` N/P FK; `status` R; `isDemo` R; `archivedAt` N; timestamps. Personal contact/document fields are absent.

### AthleteClubMembership

`athleteId` R FK; `clubId` R FK; `membershipType` N/P; `startDate` R; `endDate` N/P; `sourceDocumentId` N FK; `isDemo` R; `archivedAt` N; timestamps. Exact duplicates are blocked with `NULLS NOT DISTINCT`; overlap remains allowed.

### AthleteHorseRelation

`athleteId` R FK; `horseId` R FK; `relationType` N/P; `disciplineId` N/P FK; `startDate` R; `endDate` N/P; `sourceDocumentId` N FK; `isDemo` R; `archivedAt` N; timestamps. Exact duplicates are blocked; overlap remains allowed.

### HorseOwnership

`horseId` R FK; `ownerId` R FK; `startDate` R; `endDate` N/P; `ownershipShare` N/P numeric percent; `sourceDocumentId` N FK; `isDemo` R; `archivedAt` N; timestamps. Share, when set, is greater than 0 and at most 100; totals are not inferred.

## Competitions and results

### CompetitionEvent

`title` R; `slug` R/U routing key; `description` N; `startDate`, `endDate` R; `location`, `venue`, `organizerName` N/P; `countryId` N/P FK; `status` R; `publicationStatus` R; `coverMediaId` N FK; `publishedAt` N; `isDemo` R; `archivedAt` N; timestamps. End date cannot precede start date. No participant registration fields.

### CompetitionClass

`competitionEventId` R FK; `title` R; `disciplineId` R FK; `category`, `level` N/P; `competitionDate` N/P; `sortOrder` R non-negative; `status` R; `isDemo` R; `archivedAt` N; timestamps.

### CompetitionResult

`competitionClassId`, `athleteId`, `horseId` R FKs; `rank` N positive; `statusId` N FK; `resultDisplay` N; `penalties`, `timeSeconds`, `points`, `bonus` N/P numeric; `sourceDocumentId` N FK; `sourceReference` N; `publicationStatus` R; `publishedAt` N; `approvedAt`, `approvedById` N paired; `isDemo` R; `archivedAt` N; timestamps. There is no event FK and no unique pair/class constraint.

### ResultMetric

`competitionResultId` R FK; `metricCode` R/P; exactly one of `numericValue` N or `textValue` N; `unit` N/P; `sortOrder` R non-negative; `isDemo` R; `createdAt`, `updatedAt` R. Metric slot `(result, code, sortOrder)` is unique.

## Rankings

### RankingDefinition

`code` R/U technical key; `name` R; `description` N; `disciplineId` N/P FK; `subjectType` R; `status` R; `isDemo` R; `archivedAt` N; timestamps. Contains no formula.

### RankingRuleSet

`rankingDefinitionId` R FK; `version` R positive/U-within-definition; `name` R; `calculationMethod` N/P; `configuration` N JSONB; `configurationSchemaVersion` N; `engineVersion` N/P; `status` R; `effectiveFrom`, `effectiveTo` N/P; `sourceDocumentId` N FK; `sourceReference` N; `approvedAt`, `approvedById` N paired; `isDemo` R; `archivedAt` N; timestamps. Referenced/frozen versions are immutable by service policy.

### RankingPeriod

`rankingDefinitionId` R FK; `code` R/U-within-definition; `label` R; `startDate`, `endDate` N/P; `status` R; `isDemo` R; `archivedAt` N; timestamps. Dates do not imply eligibility.

### RankingSnapshot

`rankingPeriodId` R FK; `rankingRuleSetId` N/P FK; `revision` R positive/U-within-period; `snapshotAt` R; `calculationMethod` N/P; `calculationStatus` R; `publicationStatus` R; `calculatedAt`, `publishedAt` N; `createdById` N FK; `supersedesSnapshotId`, `comparisonSnapshotId` N self-FKs; `notes` N; `isDemo` R; `archivedAt` N; timestamps. Self-reference is rejected; recalculation creates a new revision.

### RankingEntry

`rankingSnapshotId` R FK; `subjectType` R; `athleteId`, `horseId` conditionally required FKs; `rank`, `previousRank`, `points` N/P; `countedResultCount`, `droppedResultCount` R non-negative; timestamps. A SQL check enforces athlete/horse/pair shape; partial indexes enforce one subject per snapshot. Rank is not unique.

### RankingEntryResult

`rankingEntryId` R FK; `competitionResultId` R FK; `isCounted` R; `pointsContribution` N/P; `decisionReason` N/P; `sortOrder` R non-negative; `createdAt` R. `(rankingEntryId, competitionResultId)` is unique. It stores evidence, not an official calculation rule.

## Deletion and visibility

- Domain, history, provenance and ranking FKs use `RESTRICT`/`NO ACTION`.
- Optional presentation media and non-approval actor FKs may use `SET NULL`.
- `CompetitionResult.approvedById` and `RankingRuleSet.approvedById` use `RESTRICT`, because clearing the actor alone would violate the paired approval invariant and destroy evidence.
- Public queries must filter archive, publication state and demo boundary.
- `archivedAt` is not legal erasure. Production retention/privacy policy remains open.

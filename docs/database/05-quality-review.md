# Database v1 Quality Review

- Reviewer: Database Quality and Migration Reviewer (Agent 5)
- Status: reviewed proposal for Lead Database Architect integration
- Date: 2026-07-22
- Reviewed inputs: infrastructure documentation, ADR-001..003, system proposal 00, domain proposal 01, competitions/results proposal 02, identifier governance proposal 03, ranking proposal 04 and their supporting matrices/contracts

## Review outcome

The proposals form a coherent PostgreSQL v1 if the Lead Architect includes the database constraints and partial indexes listed below and treats the service-enforced invariants as explicit limitations. There is no blocker for an empty, local development database. The design is not ready for production or official publication until authorization, privacy/retention, official vocabularies and publication governance are approved.

The normalized core is accepted:

- internal UUIDs are the only primary/foreign keys;
- official identifiers are never generated and are isolated in `ExternalIdentifier`;
- event data follows only `CompetitionEvent -> CompetitionClass -> CompetitionResult`;
- relation history uses interval tables rather than overwriting the current relationship;
- result metrics and ranking source links are relational, while JSON is limited to import evidence and versioned configuration;
- ranking history is snapshot/revision based and does not imply a formula;
- lifecycle/archive and publication concepts remain distinct from sporting statuses.

## Decision register

### Accepted

1. **UUID identity.** Use native PostgreSQL `uuid` for all principal, link and evidence records. Official IDs never become keys and archived UUIDs are never reused.
2. **Central external identifiers.** Keep FEI, national, licence, passport, microchip and source-system identifiers out of domain tables. Preserve raw and normalized representations plus a normalization version.
3. **Permanent identifier uniqueness.** Enforce unique `(namespace, identifierType, normalizedValue)` across active and archived rows. An archive must not free a value for reuse.
4. **Safe baseline normalization.** NFKC plus boundary trim only until issuer-specific rules are approved. Case folding, punctuation removal and leading-zero removal are rejected as generic defaults.
5. **Temporal relations.** Keep `AthleteClubMembership`, `AthleteHorseRelation` and `HorseOwnership` as separate interval tables with required `startDate`, nullable `endDate` and date-order checks.
6. **Parallel current relations.** Do not add exclusion constraints that prohibit overlapping club, rider/horse or ownership intervals. The official multiplicity rules are unknown and co-ownership is explicitly possible.
7. **Competition structure.** Require every result to reference exactly one class, athlete and horse. Do not duplicate an event FK on the result.
8. **Flexible result shape.** Allow rank-null status-only or text-only results. Do not hard-code DNS/DNF/RET/EL or discipline semantics.
9. **Relational metrics.** `ResultMetric` is the primary extension mechanism; `ImportRow.rawData` remains evidence, not the public result model.
10. **Separate state domains.** Internal publication state, event/class lifecycle, sporting result status and ranking calculation state are different concepts.
11. **Ranking revisions.** A recalculation creates a new snapshot revision. `previousRank` has meaning only with an explicit comparison snapshot.
12. **Explicit ranking subjects.** Use nullable athlete/horse FKs plus a subject-shape check and partial unique indexes. This is safer than a generic polymorphic subject pointer.
13. **Restrictive deletion.** Use `RESTRICT`/`NO ACTION` for history, results, source documents, identifiers, snapshots and source-result links. `SET NULL` is acceptable only for optional presentation media and inactive human actors where evidence remains.
14. **Demo boundary.** Demo seed data is explicitly marked wherever the model contains `isDemo`; a draft demo ranking snapshot must use `calculationMethod=DEMO` and never be published.

### Rejected

1. **One club/rider/owner enforced globally.** No such constraint is supported by confirmed rules.
2. **Unique athlete-horse pair per class.** Multiple phases, rounds and source corrections are unresolved. Detect candidates without blocking writes until the cardinality is approved.
3. **Unique rank in a snapshot or class.** Ties/ex-aequo remain possible and undefined.
4. **JSON as a domain model.** Do not move relationships, metrics, entries or source-result links into JSONB.
5. **Cascade deletion of historical children.** A parent hard delete must not silently destroy evidence.
6. **Automatic publication or ranking calculation.** Import, approval and calculation status do not make a row public.
7. **Global loose identifier normalization.** It can create false collisions and destroy official formatting.
8. **Hard-coded official status/formula dictionaries.** Demo codes must be visibly demo/provisional and cannot be treated as official.
9. **`isCurrent` on ranking snapshots.** It risks competing current rows. Select or promote a current published revision using a future approved policy.

### Conditional acceptance

| Decision                                               | Accepted for local v1 when                                                                                          | Remaining risk                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Polymorphic `ExternalIdentifier(entityType, entityId)` | one transaction service validates allowed type and target existence; integration tests cover every supported target | PostgreSQL cannot provide a real target FK; direct SQL can create dangling references |
| Polymorphic `AuditLog` target                          | audit is append-only, target UUID/type is application-validated, runtime DB role cannot update/delete audit rows    | an archived or legally erased target may no longer be resolvable                      |
| Polymorphic `ImportRow` link                           | linked type/id are both null or both present, and linking is deterministic/reviewed in one transaction              | database cannot guarantee target existence                                            |
| Required relation `startDate`                          | imports without a known date stay raw/unlinked or enter an explicitly reviewed exception path                       | inventing a date would corrupt history; nullable dates weaken interval queries        |
| Demo graph consistency                                 | seed and write services verify every connected row has the same demo classification                                 | scalar FKs do not enforce cross-table `isDemo` equality                               |
| Snapshot/rule-set immutability                         | services reject child updates after freeze/use and DB privileges prevent uncontrolled writes                        | Prisma schema alone does not make rows immutable                                      |
| Result contains an outcome                             | creation transaction validates parent fields plus metrics before commit                                             | a normal row `CHECK` cannot inspect child metrics                                     |
| Published timestamp/state consistency                  | SQL checks the same row and publication occurs via an audited transaction                                           | SQL alone cannot prove authorization or that a distinct transition occurred           |
| Ranking counts and subject/result consistency          | finalize transaction recomputes child counts and verifies result athlete/horse                                      | stored counters can drift after direct SQL changes                                    |
| `Document` without file/URL                            | allowed only if a documented pending-metadata state exists                                                          | otherwise provenance records can be unusable                                          |

## Required database checks

Prisma does not express all of these constraints. Add them to the reviewed initial migration SQL after Prisma generates the tables. Constraint names must be stable and adapted to the actual quoted table/column names.

### Common scalar checks

- non-empty trimmed technical keys and required names: country codes, role/discipline/ranking codes, slugs, identifier namespace/type/value, metric code and required display names;
- `Country.isoAlpha2 ~ '^[A-Z]{2}$'` and `Country.isoAlpha3 ~ '^[A-Z]{3}$'`;
- `Horse.birthYear` in a conservative PostgreSQL date-supported range and `birthYear = extract(year from dateOfBirth)` when both are present;
- all `sortOrder >= 0`, ranking/result ranks positive when present, import counters non-negative and rule/snapshot revisions positive;
- `timeSeconds >= 0` only if the Lead accepts this as a storage invariant; signs/ranges of penalties, points and bonus remain unconstrained;
- `MediaFile.sizeBytes >= 0`;
- `HorseOwnership.ownershipShare > 0 AND ownershipShare <= 100` when present, without a total-share constraint.

### Temporal and paired-field checks

- all relation/rule/period intervals: end is null or start is null where allowed or `end >= start`;
- `CompetitionEvent.endDate >= startDate`;
- `CompetitionResult.approvedAt` and `approvedById` are both null or both non-null;
- `RankingRuleSet.approvedAt` and `approvedById` are both null or both non-null;
- `ImportRow.linkedEntityType` and `linkedEntityId` are both null or both non-null;
- `ResultMetric` has exactly one of `numericValue` and `textValue`;
- `RankingSnapshot` cannot supersede or compare with itself;
- a published event/result/snapshot has non-null `publishedAt`; demo ranking snapshots remain draft through service policy;
- non-null ranking rule configuration requires a non-empty `configurationSchemaVersion`.

### Ranking subject check

The migration must reject every invalid shape:

```sql
CHECK (
  ("subjectType" = 'ATHLETE' AND "athleteId" IS NOT NULL AND "horseId" IS NULL)
  OR ("subjectType" = 'HORSE' AND "athleteId" IS NULL AND "horseId" IS NOT NULL)
  OR (
    "subjectType" = 'ATHLETE_HORSE_PAIR'
    AND "athleteId" IS NOT NULL
    AND "horseId" IS NOT NULL
  )
)
```

Use the actual enum labels chosen by the Lead Architect. The same migration needs the three subject-specific unique indexes from `INDEX_STRATEGY.md`.

## Required uniqueness

- `User.email` after centrally controlled trim/lowercase normalization;
- `Role.code`, `Country.isoAlpha2`, `Country.isoAlpha3`, `Discipline.code`, `CompetitionEvent.slug`, `ResultStatus.code`, `RankingDefinition.code`, `MediaFile.storageKey`;
- `UserRole(userId, roleId)` only for unarchived open assignments through a partial unique index;
- `ImportRow(importBatchId, rowNumber)`;
- `ExternalIdentifier(namespace, identifierType, normalizedValue)` including archived rows;
- temporal exact duplicate keys, using PostgreSQL `NULLS NOT DISTINCT` where a key component is nullable;
- `ResultMetric(competitionResultId, metricCode, sortOrder)`;
- `RankingRuleSet(rankingDefinitionId, version)`;
- `RankingPeriod(rankingDefinitionId, code)`;
- `RankingSnapshot(rankingPeriodId, revision)`;
- one subject of each shape per snapshot through three partial unique indexes;
- `RankingEntryResult(rankingEntryId, competitionResultId)`.

Do not make names, rank, event title, owner display name, horse passport name or athlete/horse/class tuples globally unique.

## Nullability review

### Required fields are justified

- identity, timestamps and internal lifecycle fields;
- Athlete first/last/display names; Horse display name; Owner display name; Club/Country/Discipline core names;
- class parent/discipline/title; result class/athlete/horse;
- identifier namespace/type/raw/normalized/version;
- interval `startDate` for accepted historical relations;
- ranking definition subject type, period code, snapshot revision/time/state and entry subject shape.

### Nullable provisional fields must stay nullable

- Athlete birth date, gender, country semantics and national federation;
- Horse passport name, birth date/year, sex, breed, color, birth country and studbook;
- Owner type/country and publication-related data;
- Club legal name/federation;
- event location/venue/organizer, class category/level/date;
- all result numeric values, status, display and source details;
- identifier verification/source/validity fields;
- ranking discipline, rule configuration/method/effective interval, period boundaries, points/contributions and previous rank.

Do not populate these fields with placeholders such as `UNKNOWN`, zero, current date or generated official numbers. Null means not known/not asserted; a real source literal `UNKNOWN` must remain source evidence rather than a fabricated normalized value.

## Referential action review

| Relation class                                          | Required action                                 | Rationale                                                        |
| ------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| historical membership/ownership/rider links -> subjects | `RESTRICT`                                      | preserve history                                                 |
| class -> event; result -> class/athlete/horse/status    | `RESTRICT`                                      | prevent evidence loss                                            |
| ranking entry/source links -> snapshot/subjects/results | `RESTRICT`                                      | preserve published/frozen history                                |
| identifiers/results/rules -> source document            | `RESTRICT`                                      | preserve provenance                                              |
| presentation image/cover -> media                       | `SET NULL`                                      | missing media must not delete domain data                        |
| optional non-approval actor/verifier                    | `SET NULL` only if audit/source context remains | user deactivation/removal must not destroy evidence              |
| approval actor paired with approval timestamp           | `RESTRICT`                                      | clearing only the FK would violate the pair and destroy evidence |
| child metrics/entries                                   | no cascade in normal runtime                    | even dependent rows have evidence value after publication/freeze |

Prisma `Cascade` is not accepted as a shortcut for local cleanup. Test cleanup should delete isolated test rows in an explicit dependency order or use an isolated disposable database.

## Normalization and duplicate risks

- `ExternalIdentifier` is normalized by a single versioned module; direct seed/import paths must call the same function.
- Email and internal technical codes may use documented technical trim/case normalization because they are platform keys, not official IDs.
- Exact temporal duplicates should be blocked, but overlapping non-identical periods remain allowed pending official rules.
- Name/date matching creates review candidates only. No automatic athlete, horse, owner, club or event merge is permitted.
- Event slug collision is a routing conflict, not proof that events are identical.
- Re-import of a published result must not overwrite it silently. Preserve import evidence and require reviewed update/audit.

## Cycles and cross-table invariants

Self-links on `RankingSnapshot` can create multi-row cycles even when self-reference is prohibited. The service must require predecessor direction (older revision only) and detect cycles before assignment. A database recursive trigger is not recommended for v1.

The following cannot be reliably expressed by simple Prisma relations/checks and require transactional integration tests:

- class date within event dates;
- result has at least one direct field or child metric;
- external identifier/audit/import polymorphic target exists and matches type;
- result and all joined records share demo boundary;
- snapshot rule set belongs to the period's definition;
- superseded/comparison snapshots have compatible period/definition/subject type;
- ranking entry subject type matches its definition;
- ranking source result contains the same athlete/horse as its entry;
- stored counted/dropped counts match source links;
- frozen snapshots/rule sets and children are immutable.

## Import and REST readiness

The model supports staged import because raw rows, normalized rows, status, error and reviewed linkage are separate. The API layer must batch-load related status/discipline/media records and avoid N+1 queries. Public list queries must always include `archivedAt IS NULL`, the approved publication state and the correct demo boundary. Cursor pagination should use stable tie-breakers such as `(startDate, id)`, `(rank, createdAt, id)` or `(snapshotAt, id)`; offset pagination is acceptable only for small administrative lists.

Text search requirements are not yet known. Plain B-tree indexes on names help equality/prefix ordering but not arbitrary contains search. Do not add `pg_trgm`, full-text indexes or accent-folding until language/search behavior is specified and query plans are measured.

## Test gate required before acceptance

Use a real local PostgreSQL 16 database, not a mocked Prisma client. In addition to the requested functional cases, tests must directly assert database rejection of:

- duplicate external identifier tuple, including after archive;
- invalid interval and rank;
- invalid result metric XOR shape;
- invalid ranking subject shape and duplicate snapshot subject;
- duplicate ranking revision and duplicate entry-result source;
- missing mandatory result class (normal Prisma call plus, where useful, raw SQL proof);
- hard deletion of referenced athlete/horse/class/result/document;
- incomplete approval/link field pairs.

Run the demo seed twice and compare stable counts/IDs. Tests that delete data must target an explicitly named disposable local test database or a unique isolated test dataset.

## Blockers and risks

### No local-v1 blocker when mitigations are implemented

- polymorphic target references are acceptable only as a documented application-enforced compromise;
- partial indexes and checks must be manually added and retained in migration SQL;
- cross-table invariants and freeze behavior must have PostgreSQL integration tests.

### Blocks production or official publication

1. authentication, authorization, database-role and publication/approval policy are not approved;
2. data privacy, owner/athlete visibility, retention, erasure and audit retention are unresolved;
3. official status, discipline, category, level and identifier namespace vocabularies are absent;
4. ranking formula, eligibility, precision, tie and dropped-result rules are absent;
5. authoritative import/verification sources and official identifier normalization are absent;
6. backup/PITR, restore tests, secrets, pooler and zero-downtime migration procedures are absent;
7. an explicit decision is still required on database-enforced generic entity references versus the v1 service-enforced compromise.

## Lead Architect integration checklist

- [ ] Record accepted/rejected/conditional decisions and open questions.
- [ ] Keep all provisional fields nullable/configurable.
- [ ] Generate the Prisma migration only after the final schema and data dictionary agree.
- [ ] Add and name the manual checks/partial indexes in migration SQL.
- [ ] Review every FK action and verify no unintended cascade.
- [ ] Apply the migration to an empty disposable PostgreSQL 16 database.
- [ ] Run repeatable demo seed and real-database constraint tests.
- [ ] Compare the final Prisma schema, SQL migration, data dictionary, ER diagram and index inventory for drift.

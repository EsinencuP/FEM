# Proposal 03: Identifiers and Data Governance

## Status and scope

- Author role: Identifiers and Data Governance agent.
- Status: proposal for Lead Database Architect review.
- Scope: internal UUIDs, official/external identifiers, verification, duplicate handling, soft delete, audit and migration safeguards.
- Out of scope: assigning or validating official Federation rules, generating official identifiers, authentication policy and legal retention periods.

This proposal does not change `prisma/schema.prisma`. Decisions marked **provisional** must remain configurable or be confirmed before production use.

## Identifier classes

| Class                           | Examples                                                                      | Created by the platform | Primary key | Public by default            | Decision                        |
| ------------------------------- | ----------------------------------------------------------------------------- | ----------------------- | ----------- | ---------------------------- | ------------------------------- |
| Internal identity               | UUID for Athlete, Horse, Club, Owner, CompetitionEvent and other main records | Yes                     | Yes         | No                           | Accepted                        |
| Official person/organization ID | FEI ID, national ID, licence number                                           | No                      | No          | No; exposure requires policy | Accepted                        |
| Official horse ID               | FEI ID, passport number, microchip                                            | No                      | No          | No; exposure requires policy | Accepted                        |
| External source ID              | Provider event code, import-system key                                        | No                      | No          | Only if contract permits     | Accepted                        |
| Human-readable public locator   | Event slug                                                                    | Platform may create it  | No          | Yes                          | Separate from official identity |

An internal UUID proves only database identity. It must never be labelled as an FEI ID, national ID, licence, passport or microchip number.

## Internal UUID policy

1. Every main entity receives an application-generated UUID stored in PostgreSQL's native `uuid` type.
2. UUIDs are immutable, opaque, never reused and do not encode entity type, date, country or business meaning.
3. Foreign keys reference UUIDs, never names, slugs or official numbers.
4. Import processes create a UUID only after a row is accepted as a new record or explicitly linked to an existing record.
5. An archived record keeps its UUID. Restore uses the same UUID; cloning or re-creation uses a new UUID.
6. API exposure of a UUID does not convert it into a national licence or public federation number.
7. The exact UUID version is an internal implementation choice. Prisma's `uuid()` is suitable for v1; changing generation strategy later must not rewrite existing keys.

## Where official identifiers are stored

### Main tables

Main domain tables store only their internal `id` and business attributes required by their own lifecycle. They do **not** contain direct `feiId`, `nationalId`, `licenseNumber`, `passportNumber` or `microchip` columns in v1.

This avoids sparse columns, inconsistent verification fields and schema changes for each new external namespace. It also permits multiple historical identifiers of one scheme when the source later confirms replacement or validity intervals.

Fields such as `CompetitionEvent.slug` are not official identifiers and remain on the main table because they are application routing attributes. `ImportRow.linkedEntityId` is an import linkage, not an official identifier.

### Universal `ExternalIdentifier`

The following values belong in `ExternalIdentifier`:

- FEI IDs for athletes, horses or other supported subjects;
- national federation IDs and licence numbers;
- passport and microchip numbers;
- club or owner registration codes;
- external event codes;
- source-system record keys needed for repeatable imports;
- future identifiers whose issuing namespace can be stated.

Recommended fields:

| Field                     | Type             | Required | Purpose                                                                               | Status                                        |
| ------------------------- | ---------------- | -------- | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| `id`                      | UUID             | Yes      | Internal immutable PK for the identifier record                                       | Accepted                                      |
| `entityType`              | enum/string code | Yes      | Type of referenced entity                                                             | Accepted; allowed values follow actual schema |
| `entityId`                | UUID             | Yes      | Internal UUID of referenced entity                                                    | Accepted                                      |
| `identifierType`          | enum/string code | Yes      | FEI, national, licence, passport, microchip, external event or source-record category | Provisional vocabulary                        |
| `namespace`               | string           | Yes      | Issuer/source scope such as an approved FEI or federation namespace                   | Accepted concept; codes provisional           |
| `value`                   | string           | Yes      | Original value as received, without secret data                                       | Accepted                                      |
| `normalizedValue`         | string           | Yes      | Deterministic comparison value                                                        | Accepted; per-namespace rules provisional     |
| `normalizationVersion`    | string           | Yes      | Version of normalization policy used                                                  | Accepted                                      |
| `verificationStatus`      | enum/string code | Yes      | Internal workflow state, not official validity                                        | Provisional vocabulary                        |
| `isPrimary`               | boolean          | Yes      | Preferred display identifier of this entity/type/namespace                            | Provisional until display policy is approved  |
| `validFrom` / `validTo`   | timestamp/date   | No       | Issuer-confirmed validity interval                                                    | Provisional and nullable                      |
| `sourceDocumentId`        | UUID FK          | No       | Evidence document when retained lawfully                                              | Accepted, nullable                            |
| `sourceReference`         | string           | No       | Non-secret source citation or import reference                                        | Accepted, nullable                            |
| `verifiedAt`              | timestamp        | No       | When verification occurred                                                            | Accepted, nullable                            |
| `verifiedById`            | UUID FK to User  | No       | Who performed verification                                                            | Accepted, nullable                            |
| `archivedAt`              | timestamp        | No       | Soft-delete/supersession marker                                                       | Accepted                                      |
| `createdAt` / `updatedAt` | timestamp        | Yes      | Record lifecycle                                                                      | Accepted                                      |

`entityType + entityId` is a polymorphic reference. Prisma/PostgreSQL cannot express a normal foreign key from one column pair to multiple tables. Lead Architect must choose one of these implementations:

1. **Recommended for v1:** retain the universal pair, enforce target existence and type in a single domain service transaction, prohibit hard deletion of referenced records and add integration tests.
2. Use one nullable FK per supported entity plus a SQL `CHECK` requiring exactly one target. This gives database-level referential integrity but makes every new subject type a schema migration.
3. Introduce a shared registry/supertype table. This gives a real generic FK but increases joins and lifecycle complexity.

This trade-off must be recorded in `OPEN_QUESTIONS.md` if the Lead Architect does not decide it in v1.

## Uniqueness and indexing

### Required uniqueness

- `ExternalIdentifier.id` is globally unique by primary key.
- `(namespace, identifierType, normalizedValue)` must be unique for all records, including archived records. Archiving must not release an official identifier for reuse.
- Re-import of the same normalized identifier for the same entity is idempotent; it updates provenance only through an explicit reviewed workflow.
- Collision of the same tuple against a different entity is a conflict, never an automatic reassignment.

If an issuing authority confirms that the same visible value may legitimately be reused, it must receive a different namespace or an explicitly approved scoped uniqueness design. Do not weaken the global rule on speculation.

### Recommended supporting indexes

- `(entityType, entityId, archivedAt)` for resolving identifiers of an entity;
- `(identifierType, normalizedValue)` for search and duplicate review;
- `(verificationStatus, archivedAt)` for governance work queues;
- `(sourceDocumentId)` and `(verifiedById)` for traceability;
- `(namespace, identifierType, isPrimary, archivedAt)` only if primary-display filtering becomes frequent.

A partial unique index enforcing one active primary identifier per `(entityType, entityId, namespace, identifierType)` may be added with reviewed SQL because Prisma schema syntax does not model PostgreSQL partial indexes. Whether one primary is a valid official rule is **provisional**.

## Normalization policy

Normalization is for comparison; `value` preserves the received representation.

Safe baseline when an issuer-specific rule is unavailable:

1. reject empty values and control characters;
2. apply Unicode NFKC normalization;
3. trim leading/trailing whitespace;
4. preserve punctuation, leading zeroes and internal characters;
5. store the policy version;
6. keep `normalizedValue` immutable unless a controlled renormalization migration is performed.

Do not remove spaces, hyphens, country prefixes, check digits or leading zeroes unless the issuing authority confirms that transformation. Do not uppercase or lowercase for uniqueness unless case-insensitivity is confirmed. A looser comparison key may be calculated transiently to propose duplicate candidates, but it must not silently merge records or overwrite the canonical normalized value.

Normalization functions belong in one tested module shared by write APIs and import jobs. They must not be reimplemented in controllers, seed scripts or one-off import code.

## Verification and provenance

Verification is an internal statement about evidence reviewed by the platform; it is not official certification.

- New imported or manually entered identifiers start unverified unless an approved trusted-source policy says otherwise.
- Verification requires a non-secret source reference or permitted document, verifier, timestamp and audit event.
- Changing `value`, `normalizedValue`, namespace, type, target entity or verification state is a critical audited action.
- A verified identifier is corrected by a reviewed transition, not by an unaudited overwrite.
- Rejection or conflict preserves the received value and evidence for traceability, subject to retention/privacy policy.
- Verification statuses may include internal concepts such as unverified, verified, rejected and conflict, but final codes and permissions are **provisional**.
- Passwords, tokens, full database URLs and secret-bearing documents must never be stored in identifier provenance or audit JSON.

## Duplicate handling

1. Exact unique-tuple matches to the same entity are idempotent.
2. Exact matches to different entities are quarantined as conflicts; imports record a failed/conflict `ImportRow` and do not relink data.
3. Similar names, dates or loosely normalized identifiers produce review candidates only.
4. No automatic merge is permitted for Athlete, Horse, Owner, Club, CompetitionEvent or official identifiers.
5. A reviewed merge selects a survivor UUID, migrates allowed references transactionally, archives the duplicate and writes an audit event with reason. The discarded UUID is never reused.
6. Conflicting verified identifiers require elevated review; neither record is physically deleted to make the constraint pass.
7. Deduplication must not infer FEI identity from names or generate a missing official ID.

Detailed operational rules are in `docs/database/DEDUPLICATION_RULES.md`.

## Soft delete and retention

- Official/domain records use `archivedAt` and, where applicable, an internal status instead of physical deletion.
- Archiving does not cascade into historical memberships, ownerships, results, audit logs or external identifiers.
- Foreign keys from historical or evidence records should default to `RESTRICT`/`NO ACTION`, not destructive cascade.
- Join/link records that have no independent evidentiary value may use cascade only when the Lead Architect documents the reason. Historical interval records do have evidentiary value and must not cascade.
- External identifiers remain reserved after archive. Reassignment requires a separately approved official rule and an audited operation.
- Hard deletion is limited to local demo/test cleanup, failed pre-acceptance staging data, or a legally approved erasure workflow. It must never be a normal API operation.
- Retention, anonymization and legal erasure requirements for Moldova/EU remain open. Soft delete alone is not a compliance policy.

## Audit trail

Critical writes should create `AuditLog` in the same database transaction as the domain change whenever possible. Required coverage:

- external identifier create, change, verify, reject, conflict, archive, restore or reassignment;
- merges and deduplication decisions;
- archive/restore of official/domain records;
- changes to competition-result approval/publication and ranking publication/configuration;
- import acceptance, rejection and linking decisions;
- changes to roles or governance permissions.

Audit records contain actor, action, entity type and UUID, redacted old/new data, reason, request ID and timestamp. Audit is append-only at the application level. It never stores passwords, access/refresh tokens, cookies, authorization headers, database URLs or unredacted sensitive document contents.

## Import governance

- `ImportBatch` records source, filename, checksum and counts; repeat checksum detection prevents accidental duplicate ingestion but does not prove business equality.
- `ImportRow.rawData` preserves permitted source input; `normalizedData` records transformation output and policy version.
- No row may create or attach an official identifier before normalization and unique-conflict checks.
- Ambiguous rows remain unlinked or conflicted for human review.
- `linkedEntityId` is written only after a deterministic unique match or reviewed choice.
- Import source trust levels and auto-verification privileges are **provisional** and must be configured, not inferred from filenames.

## Migration safeguards

1. Generate migrations only against the local PostgreSQL database.
2. Run format, validate and generate before migration creation.
3. Review SQL for drops, type rewrites, nullability changes, FK actions, unique constraints and indexes.
4. Before adding identifier uniqueness, run duplicate and null preflight queries and resolve conflicts explicitly.
5. Add required non-null fields to populated tables through expand/backfill/validate/contract steps.
6. Renormalization requires a versioned backfill, collision report and rollback/repair plan; never update all identifiers blindly.
7. Use concurrent index creation for large production tables when operationally required; Prisma-generated transactional migrations may need a reviewed manual SQL adjustment.
8. Do not rewrite an applied migration. Apply corrections through a new migration.
9. Production migration execution needs backup/recovery readiness, observability and approved ownership; these policies remain open.

## Decisions for Lead Architect

### Recommended acceptance

- all main entities use immutable internal UUIDs;
- all official/external numbers use `ExternalIdentifier` rather than direct entity columns;
- namespace/type/normalized value is permanently unique;
- raw representation and normalization version are retained;
- official records and identifiers use archive, not routine hard delete;
- duplicate resolution and critical changes are audited;
- no automatic generation of FEI, national, licence, passport or microchip values.

### Provisional or open

- exact identifier type and namespace code dictionaries;
- issuer-specific normalization and format validation;
- whether identifier values are public, masked or private by type;
- authoritative sources and which may auto-verify;
- one-primary-per-type rule;
- polymorphic reference implementation;
- retention, erasure and audit retention periods;
- permissions required for verification, conflict resolution and merge;
- whether an official authority allows an identifier value to be reused.

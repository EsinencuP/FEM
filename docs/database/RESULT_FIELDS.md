# Result Fields Contract

## Purpose

This document defines the storage boundaries for `CompetitionResult` and `ResultMetric`. It does not define official Federation scoring, ranking, eligibility or status codes. Every discipline-specific interpretation below remains `provisional` until it is backed by an approved source.

## Outcome representation

A result always belongs to one `CompetitionClass`, one `Athlete` and one `Horse`. The outcome can be represented by any supported combination that is present in the source:

- a positive `rank`;
- a reference to a data-managed `ResultStatus`;
- human-readable `resultDisplay`;
- one or more standard nullable numeric fields;
- one or more typed `ResultMetric` rows.

The system must not manufacture a value to fill an absent field. In particular, it must not convert a status-only result into rank zero or generate FEI/Federation codes.

## Core result fields

| Field                | Storage                 | Nullability | Source and meaning                                              | Validation                                                                              | Decision                                         |
| -------------------- | ----------------------- | ----------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `competitionClassId` | UUID FK                 | required    | Class in which the performance occurred                         | Referenced class must exist; no event-only result                                       | confirmed                                        |
| `athleteId`          | UUID FK                 | required    | Athlete in the source result                                    | Referenced athlete must exist; no generated official ID                                 | confirmed                                        |
| `horseId`            | UUID FK                 | required    | Horse in the source result                                      | Referenced horse must exist; no generated official ID                                   | confirmed                                        |
| `rank`               | integer                 | nullable    | Published placing                                               | Must be greater than zero when present; ties and rank display rules remain provisional  | confirmed structure                              |
| `statusId`           | UUID FK                 | nullable    | Source-backed sports outcome status                             | References `ResultStatus`; code semantics cannot be hard-coded                          | confirmed structure, provisional vocabulary      |
| `resultDisplay`      | text                    | nullable    | Exact human-readable result representation suitable for display | Trim; retain meaningful source punctuation; do not use as numeric truth                 | confirmed                                        |
| `penalties`          | decimal                 | nullable    | Source penalties                                                | Precision, sign and discipline applicability are provisional                            | provisional semantics                            |
| `timeSeconds`        | decimal                 | nullable    | Source duration normalized to seconds where safe                | Non-negative unless an approved source says otherwise; retain source display separately | provisional semantics                            |
| `points`             | decimal                 | nullable    | Points stated for this competition result                       | Must not be treated as ranking points automatically                                     | provisional semantics                            |
| `bonus`              | decimal                 | nullable    | Source-stated bonus value                                       | Never calculate without an approved rule                                                | provisional semantics                            |
| `sourceDocumentId`   | UUID FK                 | nullable    | Document that substantiates the result                          | Referenced document must exist; restrict deletion for published results                 | confirmed                                        |
| `sourceReference`    | text                    | nullable    | URL, page, sheet/cell or other reviewable locator               | Validate URL only when the source type promises a URL; sanitize public output           | confirmed                                        |
| `publicationStatus`  | internal enum/reference | required    | Internal publishing workflow                                    | Default draft; publishing requires a separate command                                   | confirmed structure, provisional extended states |
| `approvedAt`         | timestamp with timezone | nullable    | Editorial approval timestamp                                    | Pair with `approvedById`; does not claim sporting certification                         | confirmed                                        |
| `approvedById`       | UUID FK                 | nullable    | Internal user responsible for approval                          | Pair with `approvedAt`; authorization belongs in service layer                          | confirmed                                        |
| `publishedAt`        | timestamp with timezone | nullable    | First/current explicit publication timestamp                    | Required for public state; exact republish history is in audit                          | confirmed addition                               |
| `isDemo`             | boolean                 | required    | Demo-data separation                                            | Must agree with related seed/demo graph                                                 | confirmed                                        |
| `archivedAt`         | timestamp with timezone | nullable    | Soft-delete/archive marker                                      | Archived rows are excluded from public queries                                          | confirmed                                        |

## Standard numeric fields versus metrics

Use a standard `CompetitionResult` numeric field only when the source meaning maps unambiguously to that field. Otherwise create a `ResultMetric`.

| Situation                                           | Store in                                       | Reason                                                         |
| --------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Overall published place                             | `rank`                                         | Stable cross-discipline structural concept                     |
| Official/source status without a place              | `statusId`                                     | Normalized dictionary relation                                 |
| Source result string such as a composite time/score | `resultDisplay`                                | Preserves source meaning without unsafe parsing                |
| Clearly identified overall penalty                  | `penalties`                                    | Common requested field, nullable                               |
| Clearly identified elapsed time                     | `timeSeconds` plus `resultDisplay` when needed | Numeric sorting while preserving source rendering              |
| Clearly identified competition points               | `points`                                       | Distinct from ranking points                                   |
| Source-defined bonus                                | `bonus`                                        | Stored only; never computed by v1                              |
| Judge/round/phase or any additional value           | `ResultMetric`                                 | Repeatable, ordered, source-backed structure                   |
| Unknown raw import columns                          | `ImportRow.rawData`                            | Evidence layer pending mapping; not a public schema substitute |

## ResultMetric contract

| Field                 | Storage         | Nullability            | Validation                                                           | Decision                                |
| --------------------- | --------------- | ---------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| `competitionResultId` | UUID FK         | required               | Parent result must exist                                             | confirmed                               |
| `metricCode`          | normalized text | required               | Non-empty; source mapping documented; no invented official semantics | confirmed structure, provisional values |
| `numericValue`        | decimal         | conditionally required | Exactly one of numeric/text values is present                        | confirmed                               |
| `textValue`           | text            | conditionally required | Exactly one of numeric/text values is present                        | confirmed                               |
| `unit`                | text            | nullable               | Preserve source unit; no conversion without approved rule            | provisional vocabulary                  |
| `sortOrder`           | integer         | required               | Greater than or equal to zero                                        | confirmed                               |

Metric codes are not a hidden scoring engine. They identify imported/published measurements only. A code must carry source documentation outside application constants. No list of discipline-specific metric codes is approved in v1.

Recommended uniqueness is `(competitionResultId, metricCode, sortOrder)`. This permits repeated metric codes from separate source positions without accepting an exact duplicate slot.

## Supported shapes

These are structural shapes, not invented records or official code values.

### Ranked numeric result

- `rank`: present;
- one or more standard numeric values: optional;
- `statusId`: optional only if a sourced status also applies;
- `resultDisplay`: optional source-faithful display.

### Status-only result

- `rank`: null;
- `statusId`: present and points to an approved/provisional dictionary record;
- numeric fields: null unless explicitly stated by the source.

This shape supports statuses such as DNS, DNF, RET, EL or disqualification once their actual codes and meanings are loaded from an approved source. This document does not assign those codes.

### Text-only result

- `rank`: optional;
- `resultDisplay`: present;
- numeric fields: null when parsing would be ambiguous;
- raw import value retained in `ImportRow`.

### Result with additional measurements

- core fields represent the overall result;
- each extra source measurement becomes one ordered `ResultMetric`;
- no ranking formula is inferred from metrics.

## Data integrity rules

### Database-enforceable

1. Required foreign keys: class, athlete and horse.
2. `rank` is null or positive.
3. `sortOrder` is non-negative.
4. Each metric contains exactly one of `numericValue` and `textValue`.
5. Approval actor/timestamp are paired unless a separately approved system-approval mode is introduced.
6. Public state requires `publishedAt`; creation defaults to draft.
7. Referenced domain records are not cascade-deleted.

### Transactional service validation

1. A result contains at least one outcome value directly or through metrics.
2. The result, athlete, horse, class/event and source all belong to the same demo/non-demo data boundary.
3. A class date, if supplied, is consistent with event dates.
4. A publish operation is explicit, authorized and audited.
5. Changes to published rank/status/metrics include a reason and source context.
6. Duplicate candidates for the same class/athlete/horse are reviewed instead of silently merged.

### Not enforceable until rules are approved

- whether rank and particular statuses are mutually exclusive;
- whether the same athlete-horse pair can have multiple rows per class;
- whether approval must precede publication;
- valid ranges/scales for penalties, time, points and bonus;
- tie/ex-aequo rank representation;
- discipline-specific required metrics;
- whether negative points or bonuses are valid;
- calculation or eligibility impact of any result field.

## Publication boundary

`ResultStatus` and `publicationStatus` solve different problems:

| Concept                       | Meaning                               | Public?                       | Controlled by                            |
| ----------------------------- | ------------------------------------- | ----------------------------- | ---------------------------------------- |
| `ResultStatus`                | Sporting outcome copied from a source | yes, when result is published | Approved result-status dictionary/source |
| `publicationStatus`           | Platform visibility workflow          | no as raw editorial state     | Authorized platform command              |
| `approvedAt` / `approvedById` | Editorial approval evidence           | internal                      | Authorization policy                     |
| `publishedAt`                 | Publication event timestamp           | usually yes                   | Explicit publication transition          |
| `archivedAt`                  | Soft-deletion/archive marker          | no                            | Authorized archive transition            |

An imported or approved-looking status never auto-publishes a result. Public REST queries must explicitly select public publication state and non-archived rows.

## Sorting and API guidance

- Default class table order: ranked rows by positive `rank`, followed by unranked/status-only rows according to an explicitly selected presentation rule; the latter rule is provisional.
- Never sort numeric values by `resultDisplay` text.
- Expose decimal values as strings in JSON when needed to preserve Prisma/PostgreSQL precision; the API DTO contract must document this.
- Include status code and localized label from `ResultStatus`, but do not make frontend clients infer business behavior from the code.
- Return metrics ordered by `sortOrder`, then stable `id` as a tie-breaker.
- Pagination should use a deterministic order; class result lists can use `(rank, createdAt, id)` with explicit null ordering after UX/API requirements are approved.

## Index summary

| Table               | Index                                                 | Primary query                          |
| ------------------- | ----------------------------------------------------- | -------------------------------------- |
| `CompetitionResult` | `(competitionClassId, publicationStatus, rank)`       | Public class result table              |
| `CompetitionResult` | `(athleteId, publicationStatus, createdAt)`           | Athlete result history                 |
| `CompetitionResult` | `(horseId, publicationStatus, createdAt)`             | Horse result history                   |
| `CompetitionResult` | `(statusId, publicationStatus)`                       | Result-status filtering                |
| `CompetitionResult` | `(sourceDocumentId)`                                  | Provenance lookup                      |
| `ResultMetric`      | `(competitionResultId, sortOrder)`                    | Ordered metrics for a result           |
| `ResultMetric`      | unique `(competitionResultId, metricCode, sortOrder)` | Exact metric-slot duplicate prevention |

## Test cases required from this contract

1. Create a class-bound result with existing athlete and horse.
2. Reject a result without `competitionClassId`.
3. Accept a sourced status-only result with `rank = null`.
4. Reject rank zero and negative rank.
5. Accept nullable numeric fields.
6. Persist a numeric metric and a text metric.
7. Reject a metric with neither or both value columns populated.
8. Keep a newly created/imported result non-public by default.
9. Publish only through the explicit transition and record audit data.
10. Archive without physically deleting the result or its provenance.
11. Flag (rather than auto-merge) a duplicate class/athlete/horse candidate.

## Unresolved inputs

The Lead Architect should add these to `docs/OPEN_QUESTIONS.md`: official result-status vocabulary; discipline/season scope of statuses; allowed numeric precision/ranges/units; tie handling; multiple results per pair/class; approval and unpublication workflow; result-source public visibility; and representation of team or multi-phase formats.

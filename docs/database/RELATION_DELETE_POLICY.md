# Relation Delete Policy

- Status: audited MVP baseline
- Date: 2026-07-22
- Default runtime operation: archive, not physical delete

## Policy

| Relation group                                                                    | Action     | Reason                                                                                                        |
| --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Country/federation/discipline to domain records                                   | `RESTRICT` | Reference meaning must remain stable; dictionaries are archived instead.                                      |
| Athlete or Horse to CompetitionResult                                             | `RESTRICT` | Official/historical result evidence must never disappear with a subject.                                      |
| CompetitionEvent to CompetitionClass; class to result                             | `RESTRICT` | An event cannot physically remove classes or published/result history.                                        |
| AthleteClubMembership to athlete/club                                             | `RESTRICT` | Membership history is independent evidence.                                                                   |
| AthleteHorseRelation to athlete/horse/discipline                                  | `RESTRICT` | Sporting relationship history must be retained.                                                               |
| HorseOwnership to horse/owner                                                     | `RESTRICT` | Ownership history must be retained.                                                                           |
| Source Document to identifiers, histories, results and ranking rule sets          | `RESTRICT` | Provenance cannot be silently detached.                                                                       |
| ResultMetric to CompetitionResult                                                 | `RESTRICT` | Metrics are result evidence; cleanup is explicit and ordered.                                                 |
| Ranking graph and RankingEntryResult evidence                                     | `RESTRICT` | Snapshots and their source-result links are historical records.                                               |
| CompetitionResult/RankingRuleSet to approval actor                                | `RESTRICT` | `approvedAt` and `approvedById` are a validated pair; `SET NULL` would invalidate or erase approval evidence. |
| Athlete photo, Horse image, Event cover                                           | `SET NULL` | Presentation media may be removed without invalidating the subject.                                           |
| Audit actor, import creator, identifier verifier, role assigner, snapshot creator | `SET NULL` | Historical event remains meaningful after actor lifecycle changes; actor identity is optional by schema.      |

No relation uses `ON DELETE CASCADE` in the baseline. PostgreSQL catalog audit found 45 restrictive and 9 set-null foreign keys.

## Operational rule

Normal API services must update `archivedAt` (and write an audit event where required). Hard delete is limited to isolated local test/demo cleanup or an approved legal workflow. Revoking an approval requires one explicit transaction that clears the approval pair and records the reason before any actor-erasure workflow.

The five optional `SET NULL` child columns without dedicated B-tree indexes (`Athlete.photoId`, `Horse.imageId`, `CompetitionEvent.coverMediaId`, `ImportBatch.createdById`, `UserRole.assignedById`) are intentionally not indexed in this baseline: hard deletion is exceptional and no list query uses these columns. Re-evaluate with production-like volume and query plans.

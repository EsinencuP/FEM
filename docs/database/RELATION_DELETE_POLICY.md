# Relation Delete Policy

- Status: audited MVP baseline
- Date: 2026-07-22
- Default runtime operation: archive, not physical delete

## Policy

| Relation group                                                                     | Action     | Reason                                                                                                        |
| ---------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Country/federation/discipline to domain records                                    | `RESTRICT` | Reference meaning must remain stable; dictionaries are archived instead.                                      |
| Athlete or Horse to CompetitionResult                                              | `RESTRICT` | Official/historical result evidence must never disappear with a subject.                                      |
| CompetitionEvent to CompetitionClass; class to result                              | `RESTRICT` | An event cannot physically remove classes or published/result history.                                        |
| AthleteClubMembership to athlete/club                                              | `RESTRICT` | Membership history is independent evidence.                                                                   |
| AthleteHorseRelation to athlete/horse/discipline                                   | `RESTRICT` | Sporting relationship history must be retained.                                                               |
| HorseOwnership to horse/owner                                                      | `RESTRICT` | Ownership history must be retained.                                                                           |
| Source Document to identifiers, histories, results and ranking rule sets           | `RESTRICT` | Provenance cannot be silently detached.                                                                       |
| ResultMetric to CompetitionResult                                                  | `RESTRICT` | Metrics are result evidence; cleanup is explicit and ordered.                                                 |
| Ranking graph and RankingEntryResult evidence                                      | `RESTRICT` | Snapshots and their source-result links are historical records.                                               |
| CompetitionResult/RankingRuleSet to approval actor                                 | `RESTRICT` | `approvedAt` and `approvedById` are a validated pair; `SET NULL` would invalidate or erase approval evidence. |
| Athlete photo, Horse image, Event cover                                            | `SET NULL` | Presentation media may be removed without invalidating the subject.                                           |
| Audit actor and AdminSession evidence                                              | `RESTRICT` | Security/domain evidence must retain the attributed actor and session.                                        |
| UserCredential, AdminSession, AdminRecoveryCode, IdempotencyRecord to User/session | `RESTRICT` | Authentication and replay evidence cannot disappear through user/session hard delete.                         |
| RolePermission to Role/Permission                                                  | `RESTRICT` | Permission vocabulary and assignments require explicit ordered lifecycle changes.                             |
| Import creator, identifier verifier, role assigner, snapshot creator               | `SET NULL` | Non-security historical event remains meaningful after optional actor lifecycle changes.                      |

No relation uses `ON DELETE CASCADE`. The original catalog count is historical;
Stage 2 adds only restrictive security foreign keys. The exact final count is
recalculated during the clean release database audit.

## Operational rule

Normal API services must update `archivedAt` and write an atomic audit event.
Hard delete is limited to isolated local test/demo cleanup or an approved legal
workflow. Revoking approval or security evidence requires an explicit,
reasoned, audited lifecycle operation before any actor-erasure workflow.

`ResultMetric` is the only current Admin API hard-delete exception: it is a
draft-only dependent technical correction. The service rejects metric
create/update/delete once its parent result is published or approved, and the
delete is audited before commit.

The five optional `SET NULL` child columns without dedicated B-tree indexes (`Athlete.photoId`, `Horse.imageId`, `CompetitionEvent.coverMediaId`, `ImportBatch.createdById`, `UserRole.assignedById`) are intentionally not indexed in this baseline: hard deletion is exceptional and no list query uses these columns. Re-evaluate with production-like volume and query plans.

# Database v1 + Admin Security ER Diagram

The diagram shows storage relationships, not authorization, registration or a ranking-calculation process. Polymorphic `ExternalIdentifier`, `AuditLog` and `ImportRow` targets are intentionally not drawn as database foreign keys.

```mermaid
erDiagram
    User ||--o{ UserRole : receives
    Role ||--o{ UserRole : assigns
    Role ||--o{ RolePermission : grants
    Permission ||--o{ RolePermission : included_in
    User ||--o| UserCredential : authenticates
    User ||--o{ AdminSession : opens
    User ||--o{ AdminRecoveryCode : owns
    User ||--o{ IdempotencyRecord : submits
    AdminSession ||--o{ IdempotencyRecord : scopes
    AdminSession o|--o{ AuditLog : correlates
    User o|--o{ AuditLog : acts
    User o|--o{ ImportBatch : creates
    User o|--o{ CompetitionResult : approves
    User o|--o{ RankingRuleSet : approves
    ImportBatch ||--o{ ImportRow : contains
    MediaFile o|--o{ Document : stores
    Document o|--o{ ExternalIdentifier : proves

    Country ||--o{ NationalFederation : hosts
    Country o|--o{ Club : locates
    NationalFederation o|--o{ Club : affiliates
    Country o|--o{ Athlete : represents
    NationalFederation o|--o{ Athlete : affiliates
    Country o|--o{ Horse : born_in
    Country o|--o{ Owner : locates
    MediaFile o|--o{ Athlete : photo
    MediaFile o|--o{ Horse : image
    MediaFile o|--o{ CompetitionEvent : cover

    Athlete ||--o{ AthleteClubMembership : has_history
    Club ||--o{ AthleteClubMembership : has_members
    Athlete ||--o{ AthleteHorseRelation : rides
    Horse ||--o{ AthleteHorseRelation : ridden_by
    Discipline o|--o{ AthleteHorseRelation : scopes
    Horse ||--o{ HorseOwnership : has_history
    Owner ||--o{ HorseOwnership : owns
    Document o|--o{ AthleteClubMembership : sources
    Document o|--o{ AthleteHorseRelation : sources
    Document o|--o{ HorseOwnership : sources

    CompetitionEvent ||--o{ CompetitionClass : contains
    Discipline ||--o{ CompetitionClass : classifies
    CompetitionClass ||--o{ CompetitionResult : records
    Athlete ||--o{ CompetitionResult : achieves
    Horse ||--o{ CompetitionResult : achieves
    ResultStatus o|--o{ CompetitionResult : labels
    CompetitionResult ||--o{ ResultMetric : measures
    Document o|--o{ CompetitionResult : sources

    Discipline o|--o{ RankingDefinition : scopes
    RankingDefinition ||--o{ RankingRuleSet : versions
    Document o|--o{ RankingRuleSet : sources
    RankingDefinition ||--o{ RankingPeriod : divides
    RankingPeriod ||--o{ RankingSnapshot : captures
    RankingRuleSet o|--o{ RankingSnapshot : governs
    RankingSnapshot o|--o{ RankingSnapshot : supersedes
    RankingSnapshot o|--o{ RankingSnapshot : compares
    RankingSnapshot ||--o{ RankingEntry : contains
    Athlete o|--o{ RankingEntry : athlete_subject
    Horse o|--o{ RankingEntry : horse_subject
    RankingEntry ||--o{ RankingEntryResult : explains
    CompetitionResult ||--o{ RankingEntryResult : contributes
```

## Important boundaries

- `CompetitionResult` does not duplicate `competitionEventId`; the event is reached through its required class.
- Ranking snapshots are historical revisions. Recalculation creates a new graph.
- Athlete/horse pair ranking entries use both FKs, not a fabricated pair identifier.
- Archive does not cascade into relation history, results, identifiers or rankings.
- Approval actor relations are restrictive; presentation-media and non-approval optional actor relations may use `SET NULL`.
- Authentication/audit/idempotency and role-permission relations are
  restrictive; no credential or security token is represented in public DTOs.
- `RateLimitBucket` is intentionally isolated technical state keyed by the
  throttler/client window and has no domain foreign key.

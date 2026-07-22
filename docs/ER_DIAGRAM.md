# Database v1 ER Diagram

The diagram shows storage relationships, not authorization, registration or a ranking-calculation process. Polymorphic `ExternalIdentifier`, `AuditLog` and `ImportRow` targets are intentionally not drawn as database foreign keys.

```mermaid
erDiagram
    User ||--o{ UserRole : receives
    Role ||--o{ UserRole : assigns
    User o|--o{ AuditLog : acts
    User o|--o{ ImportBatch : creates
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

    Athlete ||--o{ AthleteClubMembership : has_history
    Club ||--o{ AthleteClubMembership : has_members
    Athlete ||--o{ AthleteHorseRelation : rides
    Horse ||--o{ AthleteHorseRelation : ridden_by
    Discipline o|--o{ AthleteHorseRelation : scopes
    Horse ||--o{ HorseOwnership : has_history
    Owner ||--o{ HorseOwnership : owns

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


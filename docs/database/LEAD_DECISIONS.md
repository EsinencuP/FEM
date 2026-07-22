# Database v1: Lead Architect Decisions

- Date: 2026-07-22
- Status: accepted for local Database v1 implementation
- Scope: PostgreSQL storage, migration, demo seed and constraint tests only

## Inputs reviewed

Lead Architect reviewed proposals 00–04, `ENTITY_MATRIX.md`, identifier and deduplication rules, result-field and ranking boundaries, and Agent 5 quality/index/migration review. Only this decision register authorizes integration into `prisma/schema.prisma`.

## Accepted decisions

1. Every row has an internal PostgreSQL UUID. Official identifiers are never generated and never used as primary or foreign keys.
2. FEI, national, licence, passport, microchip and source-system values live in `ExternalIdentifier`, with raw and versioned normalized values. The permanent tuple `(namespace, identifierType, normalizedValue)` is unique even after archive.
3. `ExternalIdentifier`, `AuditLog` targets and `ImportRow` links use documented application-enforced polymorphic references in v1. PostgreSQL validates field pairing, while services must validate target existence/type transactionally.
4. Athlete–club, athlete–horse and horse–owner history uses dated relation tables. Exact duplicate intervals are blocked; overlapping and multiple current relations remain allowed because official multiplicity rules are unknown.
5. Competition storage is strictly `CompetitionEvent -> CompetitionClass -> CompetitionResult`. A result requires one class, athlete and horse. Registration, application, payment, draw, start-list and live-scoring entities are prohibited.
6. `ResultStatus` is a data-managed sports-status dictionary. It is separate from internal lifecycle and publication states. Rank and all result numbers remain nullable; `ResultMetric` extends a result relationally.
7. Publication starts as `DRAFT` and changes separately from creation/calculation. Published rows require `publishedAt`; approval pairs require both actor and timestamp.
8. Ranking uses definition, versioned rule set, period, immutable snapshot revisions, entries and result evidence. No formula, coefficient, tie-breaker, eligibility rule or dropped-result policy is implemented.
9. Ranking subjects use explicit nullable athlete/horse FKs plus a SQL subject-shape check and three partial unique indexes. Rank is not unique.
10. Historical/evidence relations use restrictive deletion. Presentation media and optional human actors may use `SET NULL`. Normal runtime performs soft delete/archive, not physical deletion.
11. JSONB is limited to redacted audit snapshots, import evidence, additional metadata and versioned ranking configuration. It does not replace relationships, metrics, results or ranking entries.
12. Demo records are explicitly marked where applicable. The only seeded ranking snapshot is `isDemo=true`, `calculationMethod=DEMO`, `publicationStatus=DRAFT`.

## Rejected decisions

- generated FEI/national/passport/microchip values;
- a globally unique person, horse or event inferred from names;
- a single lifetime club, rider or owner;
- unique athlete–horse pair per class before phase/round rules are known;
- unique rank;
- cascade deletion of history, provenance, results or ranking data;
- automatic official publication or rating calculation;
- loose identifier normalization that removes punctuation, prefixes or leading zeros;
- `isCurrent` on ranking snapshots;
- JSON domain models and hard-coded federation business vocabularies.

## Conditional/application-enforced invariants

The database cannot express every cross-table rule without a registry or triggers. Services and PostgreSQL integration tests must enforce:

- polymorphic target existence/type;
- consistent demo/non-demo graphs;
- result outcome presence when direct values are absent but metrics exist;
- class date inside event dates;
- ranking rule set/period/definition compatibility;
- ranking entry subject compatibility with definition and source result;
- counted/dropped counter consistency;
- frozen snapshot/rule-set immutability and acyclic predecessor links.

These limitations are accepted only for local v1 and are recorded in `OPEN_QUESTIONS.md` before production use.


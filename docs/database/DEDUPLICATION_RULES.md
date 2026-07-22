# Deduplication Rules

## Purpose

These rules prevent accidental merging or reassignment of Federation records during manual entry, import and correction. They define an internal data-quality workflow only; they do not claim official FEI or national identity rules.

## Non-negotiable safeguards

1. Internal UUIDs are immutable and never reused.
2. The platform never generates FEI IDs, national IDs, licence numbers, passport numbers or microchip numbers.
3. Names alone never prove identity.
4. Similarity matching may create a review candidate but may not merge, archive, relink or verify a record.
5. No merge is automatic.
6. An archived identifier remains reserved and is included in duplicate checks.
7. A uniqueness error is handled as a conflict, not by deleting or weakening a constraint.

## Match classifications

| Classification        | Condition                                                                            | Automatic action allowed                                        |
| --------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Idempotent match      | Same namespace, type and normalized identifier already belongs to the same UUID      | Reuse existing link; append permitted provenance/audit metadata |
| Hard conflict         | Same namespace, type and normalized identifier belongs to a different UUID           | None; quarantine and review                                     |
| Candidate duplicate   | Similar name and compatible non-sensitive attributes, or looser comparison key match | Create/report candidate only                                    |
| Distinct record       | Confirmed evidence shows different subjects                                          | Continue with separate UUIDs                                    |
| Insufficient evidence | Data cannot distinguish subjects                                                     | Keep separate/unlinked; request review                          |

## Normalization for matching

- Canonical equality uses only the versioned normalization rule approved for the identifier namespace.
- Until issuer rules are known, canonical normalization is limited to Unicode NFKC and trimming boundary whitespace; punctuation, leading zeroes and internal characters are preserved.
- Looser comparison may ignore case or presentation separators only to produce candidates. It is never a unique key and never changes stored values.
- Raw and normalized values are retained together with `normalizationVersion`.
- A normalization-policy change requires a collision report before any backfill.

## Import workflow

For each imported row:

1. Preserve permitted source data in `ImportRow.rawData` and calculate normalized values centrally.
2. Search exact identifier tuples across active and archived records.
3. If no exact identifier exists, search for non-binding candidates using entity-appropriate fields.
4. Link automatically only when an exact identifier belongs to one existing entity and the import-source policy permits deterministic linking.
5. Treat an exact identifier attached to another UUID as a conflict.
6. Leave ambiguous rows unlinked; do not create multiple speculative identifiers.
7. Record outcome and error/conflict reason in `ImportRow` without secrets.
8. Create a new entity only after the workflow has ruled out an exact conflict and the import operation is authorized to create entities.

Checksum equality of two files prevents accidental repeat processing but does not establish that their rows describe the same real-world subjects.

## Candidate signals

Candidate signals are provisional and entity-specific. Examples may include:

- exact normalized official identifier from an approved namespace — strong conflict/match signal;
- source-system record key within the same source namespace — deterministic only within that namespace;
- matching name plus date/year of birth — review signal, not proof;
- horse passport name plus birth date/year and sex — review signal, not proof;
- horse microchip/passport value — identifier signal only after normalization and provenance checks;
- club legal name plus country — review signal, not proof;
- event title, date, venue and external source code — review signal, not proof.

Do not use protected or unnecessary sensitive data merely to improve matching.

## Manual review

A reviewer must see:

- both internal UUIDs and archive states;
- conflicting/raw/normalized identifier representations;
- namespace, source, verification state and verification dates;
- relevant non-sensitive comparison fields;
- affected references and counts;
- proposed survivor and reason;
- warning when either record has published results, verified identifiers or ranking references.

The roles authorized to review or merge remain an open security decision.

## Merge procedure

A merge is a controlled data correction, not deletion:

1. Choose a survivor UUID using evidence; never prefer the oldest/newest record automatically.
2. Obtain explicit actor, reason and request ID.
3. Lock or otherwise serialize both records to prevent concurrent changes.
4. Recheck identifier uniqueness and archive state inside the transaction.
5. Inventory all foreign-key and polymorphic references.
6. Move only references that do not create contradictory history or duplicate unique keys.
7. Preserve historical interval records; overlapping club, ownership or athlete-horse periods require separate review.
8. Attach compatible identifiers to the survivor without overwriting raw values or verification provenance.
9. Archive the duplicate and record the survivor UUID in the audit event or an approved merge record.
10. Write redacted before/after audit data in the same transaction.
11. Never reuse the duplicate UUID or silently redirect it without a documented API policy.

If any step fails, roll back the entire merge.

## Identifier conflict resolution

- Same identifier, same entity: treat as idempotent; do not create a second active copy.
- Same identifier, different entities: mark/import as conflict; do not reassign automatically.
- Corrected typo: retain the old audited value or archive/supersede its identifier record according to the accepted schema; do not erase evidence silently.
- Issuer-confirmed transfer/reuse: requires an explicit official rule, validity dates, audit and a separately approved uniqueness strategy. Until confirmed, reuse is forbidden.
- Two verified identifiers conflict: escalate; do not downgrade either automatically.

## Undo and recovery

- A merge must have a documented repair plan before execution.
- Prefer reversible reference changes and archived duplicate records over physical deletion.
- Reversal creates new audit events; historical audit entries remain append-only.
- Backup/PITR is an operational safety net, not the normal merge undo mechanism.

## Metrics and review queue

Recommended internal metrics:

- unresolved exact identifier conflicts;
- unlinked import rows;
- candidate duplicates awaiting review;
- merges by actor/source and reversal count;
- normalization-version distribution;
- identifiers lacking source or verification evidence.

Thresholds and service-level targets are provisional and belong in configuration after operational ownership is assigned.

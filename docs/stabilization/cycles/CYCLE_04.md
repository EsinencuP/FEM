# Cycle 04 — Independent Re-audit After Transaction Changes

Status: **COMPLETE WITH BUSINESS-BLOCKED DEPLOYMENT ITEMS**

## Why this cycle was required

Cycle 3 and the independent reviewers found new HIGH hypotheses after
transaction/OpenAPI changes:

- deterministic demo UUID collisions were not fully preflighted;
- primary restore paths did not revalidate archived references;
- relation and identifier checks still used Read Committed;
- OpenAPI envelope post-processing misclassified health and identifier lists;
- one E2E test depended on a previous test fixture.

## Reproduced

- A non-demo row occupying deterministic `club:1` could be overwritten.
- Restoring an athlete below an archived Country succeeded.
- Initial OpenAPI post-processing documented bare health incorrectly and
  classified identifier lists as single data objects.
- Targeted stabilization execution proved the fixture dependency.
- Parallel seed execution produced retryable P2034 without a seed-level retry.

## Corrected

- Complete deterministic-ID seed preflight and concurrent P2034 retry.
- Active/demo reference validation on primary restore.
- Shared bounded Serializable transactions across reference, history,
  identifier, archive and restore writes.
- Accurate structural OpenAPI envelopes while preserving explicit typed
  responses.
- Independent stabilization fixtures and no mutation of a shared seeded club.
- Duplicate slug/identifier race regressions.

## New tests

- deterministic non-demo UUID collision preservation;
- concurrent seed pair;
- primary restore under archived Country;
- repeated archive/restore state semantics;
- all-operation OpenAPI success contract;
- typed health and nested identifier-list OpenAPI shape;
- concurrent duplicate slug and external identifier.

## Independent adversarial result

No new CRITICAL remained after the fixes. The re-audit confirmed two deployment
blockers that cannot be closed inside the explicit scope:

- protected Admin versus allowlisted Public API boundary;
- atomic append-only audit with an approved actor/request policy.

It also confirmed MEDIUM limitations: generic resource properties in OpenAPI,
the ordered DB scenario suite, timestamp churn on repeat seed upserts, no
optimistic concurrency/idempotency protocol and no automated Bruno/Docker
outage gate.

## Decision

Technical stabilization may proceed to three clean final gates. Internet or
administrative production deployment remains **NO-GO** until the blocked
security/audit decisions are implemented.

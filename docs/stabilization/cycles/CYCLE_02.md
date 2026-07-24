# Cycle 02 — Adversarial and Recovery Scenarios

Status: **COMPLETE — findings transferred to Cycle 03**

## Checked

- hostile and oversized JSON;
- malformed JSON and correlation IDs;
- deterministic query/metric fuzz with seed `0x5eed1234`;
- concurrent event shrink versus class creation;
- concurrent result outcome removal versus last metric deletion;
- demo-boundary reparenting;
- archived and cross-boundary source documents;
- transient Prisma error taxonomy;
- bounded database health query;
- compiled runtime startup under strict pnpm resolution.
- live PostgreSQL loss and recovery on the same backend process.

## Found

- compiled runtime depended on undeclared transitive Express;
- class/result reparenting could orphan child demo provenance;
- empty text metrics counted as outcomes;
- verified identifiers remained editable;
- cross-row transactions used ReadCommitted and admitted integrity races;
- transient database failures were incompletely classified;
- mutating E2E relied only on Jest setup for its DB guard.

## Corrected

- official Nest Express body-parser API and real runtime smoke;
- safe draft-only generic mutation policy;
- active/demo reference and source-document policy;
- immutable verified identifiers;
- Serializable retry for event/class and result/metric invariants;
- transient 503/concurrent 409 mapping;
- three-second health ceiling;
- inline mutating-suite guard;
- deterministic fuzz and concurrency regressions.

## What Cycle 01 missed

- runtime dependency resolution differs from TypeScript/Jest resolution;
- descendant provenance can break during reparent, not only create;
- a transaction is not sufficient when isolation is too weak;
- test safety must survive alternate IDE/Jest entry points.

## Residual risks

- generic lost-update/idempotency contract;
- order-dependent fixtures;
- public/admin/auth boundary and application audit;
- OpenAPI and Bruno completeness;
- performance seed and query/payload measurements.

## Decision

Cycle 02 completed the adversarial/recovery pass. Residual contract,
performance and fixture findings were transferred to Cycle 03; deployment
remained blocked by the unauthenticated administrative surface.

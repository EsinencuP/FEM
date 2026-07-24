# Cycle 01 — Functional Correctness

Status: **COMPLETE — findings transferred to Cycle 02**

## Checked

- clean audit DB migrations and seed x3;
- schema/client validation;
- initial lint/typecheck/unit/DB/E2E/build;
- DTO and HTTP validation;
- event/class/result relations;
- archive and demo provenance on critical child writes;
- seed safety and rollback;
- request parser/error envelope;
- independent DB, security/API and QA/reliability reviews.

## Found

- 1 BLOCKER in E2E database isolation;
- 1 CRITICAL unsafe/non-atomic seed;
- multiple HIGH defects in boolean parsing, result outcome, date updates,
  archive/demo boundaries, identifier provenance, CI E2E, request size,
  OpenAPI, public/admin separation, audit and concurrency.

## Corrected so far

- test DB guard and CI E2E;
- guarded atomic seed;
- strict boolean parsing;
- result outcome validation;
- event shrink protection;
- transactional relation provenance/archive checks;
- server-owned unverified identifiers;
- ownership DTO constraint alignment;
- correlated body parser errors;
- non-empty PATCH DTOs.

## What the previous audit missed

- unsafe remote acceptance by name-only DB guard;
- non-demo overwrite and partial seed failure;
- query string `false` truthiness;
- cross-table event shrink;
- demo/non-demo graph mixing;
- fabricated identifier verification;
- oversized JSON becoming 500;
- near-total absence of success response schemas.

## Why it was missed

The earlier gate emphasized schema validation, compile/build and narrow
read-only smoke tests. Write E2E, mutation-sensitive tests, collision fixtures
and adversarial parser/concurrency checks were absent.

## New tests

- database target safety matrix;
- seed collision and rollback;
- DTO boundary/mass-assignment matrix;
- real HTTP archive/demo/date/body-parser scenarios.

## Residual risks

- public/admin/auth boundary;
- publication authority and atomic audit;
- OpenAPI/Bruno completeness;
- concurrency and retry semantics;
- performance and outage recovery;
- broad CRUD/search/sort regression coverage.

## Decision

Cycle 01 completed discovery and the first fix pass. Residual HIGH findings were
explicitly transferred to Cycle 02 rather than treated as closed.

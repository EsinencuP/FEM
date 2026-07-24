# Database Integrity Audit

Status: cycle 1 in progress  
Database under test: dedicated local `fem_audit_20260723_stabilization`

## Confirmed baseline

- PostgreSQL 16.14 container is healthy and persistent.
- Prisma schema validates and generated client matches two applied migrations.
- A fresh empty audit DB accepted both migrations.
- Migration SQL contains no unexpected table drop.
- Seed summary is stable across three runs: 5 countries, 1 federation,
  3 disciplines, 3 clubs, 10 athletes, 12 horses, 5 owners, 3 events,
  8 classes, 36 results and 1 draft demo ranking snapshot.

## Independently reproduced defects

- Demo seed could overwrite non-demo natural keys and commit partial data.
- Test DB policy checked only a database name and could accept a remote
  `ci_database`.
- Child writes defaulted to non-demo beneath demo parents.
- Event date shrink could leave classes outside the event period.
- Archived parents could receive or restore active children.
- External identifiers had no FK to their polymorphic target and write checks
  were non-transactional.
- Ownership share API accepted zero while PostgreSQL rejected it.

## Implemented integrity controls

- Executable local/test DB target guard shared by E2E and DB suites.
- Demo seed opt-in, collision preflight and one serializable transaction.
- Parent demo/archive checks and server-derived child `isDemo` for currently
  implemented relation/result/identifier write paths.
- Transactional event/class date check.
- Final-state result outcome checks.
- DTO/PostgreSQL ownership boundary alignment.

## Residual integrity risks

- Polymorphic targets still lack a physical FK. API checks are stronger, but a
  future importer or direct SQL writer can create an orphan.
- Current interactive transactions do not yet prove every archive/create race;
  the concurrency cycle must attempt synchronized writes.
- Historical interval overlap is intentionally not prohibited until Federation
  rules define allowed parallel memberships/owners/athlete-horse relations.
- AuditLog exists but application mutations do not yet create immutable audit
  evidence.

Current DB integrity decision: **CONDITIONAL GO for continued local
stabilization; NO-GO for production writes**.

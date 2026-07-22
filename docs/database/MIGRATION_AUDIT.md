# Migration Audit

- Date: 2026-07-22
- Scope: local PostgreSQL 16 only
- Result: passed

## Migration inventory

1. `20260722201238_initial_database_v1`
   - 30 application tables, internal enums, 54 foreign keys, manual checks and partial/NULLS-NOT-DISTINCT indexes.
   - SQL audit: no `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`, `TRUNCATE` or data deletion.
2. `20260722204033_mvp_database_stabilization`
   - Changes two approval FKs from `SET NULL` to `RESTRICT`.
   - Adds `Athlete(displayName,id)`, `Horse(birthYear,displayName,id)`, `Club(name,id)` and `CompetitionEvent(endDate,id)` indexes.
   - SQL audit: no table/column/type/data deletion. Two expected `DROP CONSTRAINT` statements replace only the old FKs, immediately followed by reviewed `ADD CONSTRAINT ... ON DELETE RESTRICT`.

## Clean install evidence

The isolated local database `equestrian_federation_clean` was created empty, then received both migrations using `prisma migrate deploy`. Prisma Client generation succeeded. `prisma migrate diff` from the migrations directory to `schema.prisma` returned `No difference detected` with exit code 0.

Catalog after deploy:

- 30 application tables;
- 133 indexes including primary/unique indexes and `_prisma_migrations`;
- 62 check constraints;
- 45 `ON DELETE RESTRICT`, 9 `ON DELETE SET NULL`, 0 cascade FKs.

## Safety conclusion

The migrations form a reproducible roll-forward baseline. The initial migration was not rewritten. The stabilization migration is additive except for reviewed FK-action replacement and is safe for the current local-only dataset. Production execution remains out of scope and requires backup/recovery, lock-duration and deployment review.

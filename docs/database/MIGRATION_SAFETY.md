# Database v1 Migration Safety

- Status: required procedure for the first domain migration
- Scope: local PostgreSQL 16 only
- Production use: prohibited until provider, backup/recovery, roles, observability and rollout procedure are approved

## Safety boundary

The first domain migration is created and applied only against an explicitly verified local database. `prisma migrate dev`, `prisma migrate reset`, `prisma db push` and manual destructive SQL must never be pointed at staging or production credentials. A connection URL must not be printed into logs or committed.

The expected starting point is an empty application schema with no domain tables. If preflight finds existing non-Prisma tables or migrations, stop and reconcile them; do not force, reset or baseline by assumption.

## Preconditions

Before generating migration SQL:

- final proposal decisions, open questions, data dictionary and ER diagram agree with `schema.prisma`;
- the local container reports healthy PostgreSQL 16;
- `DATABASE_URL` points to localhost/approved local Docker host and the expected database name;
- Git status is reviewed so unrelated/user changes are not overwritten;
- no production/staging credentials are present in `.env` or shell variables;
- schema contains no registration, application, payment, start-list, draw or live-scoring entity;
- no official ID default/generator and no ranking formula/constants exist;
- manual checks and partial indexes have stable names ready for SQL review.

## Preflight checks

Use non-secret diagnostics. Confirm host/database separately rather than echoing the full URL:

```sql
SELECT current_database(), current_user, version();
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;
```

The last query is expected to fail only when Prisma migrations have never been initialized. Any unexpected application table is a stop condition.

## Create-only workflow

Run with Node.js 22 and pnpm:

```bash
pnpm db:up
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:dev --name initial_database_v1 --create-only
```

Do not apply immediately. Locate the new `prisma/migrations/<timestamp>_initial_database_v1/migration.sql`, review it, then add only the approved PostgreSQL checks/partial indexes. Never edit a migration after it has been shared/applied outside the disposable local verification environment.

## Mandatory generated-SQL review

### Destructive operations

The initial migration must contain no unexpected:

- `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` or data-changing `DELETE`;
- destructive type rewrite or narrowing cast;
- `DROP ... CASCADE`;
- schema/database ownership or privilege change;
- extension installation not recorded in an ADR.

Because the expected schema is empty, any domain-table drop is a blocker. Search case-insensitively but inspect the full SQL, not only search output.

### Columns and defaults

Verify:

- every primary key is native `uuid` with the intended safe default;
- official identifier fields have no generated defaults;
- time instants use `timestamptz`, calendar-only values use `date`, and monetary/ranking/result values use `numeric`, not floating point;
- all provisional inputs remain nullable;
- lifecycle/publication defaults are internal neutral/draft states;
- all `isDemo` defaults are false outside explicit seed writes;
- JSONB exists only for raw/normalized import data, audit snapshots, metadata or versioned rule configuration;
- no password, token, database URL or unnecessary sensitive document field was introduced.

### Foreign keys

Inventory every FK and its `ON DELETE`/`ON UPDATE` action. Required/history/evidence references default to `RESTRICT`/`NO ACTION`. Only approved presentation/non-approval actor relations may use `SET NULL`; approval evidence uses `RESTRICT`. No cascade is accepted for historical relations, results, external identifiers, source provenance or ranking history.

Verify indexes exist on frequently joined/referenced child columns according to `INDEX_STRATEGY.md`.

### Checks and unique constraints

Confirm the SQL contains and correctly names:

- date interval/event ordering checks;
- positive ranks/revisions and non-negative counters/sort orders/sizes;
- ownership-share range;
- result metric XOR;
- approval and import-link field pairing;
- country-code shape and non-empty technical values;
- ranking snapshot self-link and publication timestamp checks;
- ranking subject shape;
- permanent external identifier tuple uniqueness;
- exact temporal duplicate constraints, including null-equivalence where required;
- three ranking subject partial unique indexes;
- active `UserRole` partial unique index.

Do not add unconfirmed exclusivity such as one active club, one active owner, unique rank or unique athlete-horse result per class.

## Apply only after approval

After SQL review:

```bash
pnpm prisma:migrate:dev
pnpm prisma:seed
```

The seed must use deterministic internal IDs or stable unique technical keys and upserts/controlled updates. It must create only clearly fictional demo people/horses/clubs/events/results, no generated official identifiers, and exactly a draft demo ranking snapshot. Run it twice and verify stable IDs and counts.

## Clean-database verification

Applying to the developer database is not sufficient proof. Create an explicitly named disposable local verification database, point a temporary process-scoped `DATABASE_URL` at it, and run:

```bash
pnpm prisma:migrate:deploy
pnpm prisma:seed
pnpm prisma:seed
```

Then run database constraint tests and inspect counts/relations. Before dropping the disposable database, re-query `current_database()` and confirm the exact expected name. Never calculate or wildcard a destructive target. Drop only that explicit local verification database after all sessions are disconnected.

If a disposable database cannot be created, use a dedicated explicitly named local test schema/database with equivalent isolation. Do not reset the developer's persistent database as a shortcut.

## Verification queries

At minimum inspect:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT conrelid::regclass AS table_name, conname, contype,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

Check seed summaries for the requested countries, federation, disciplines, clubs, athletes, horses, owners, temporal links, three events with classes, 30-40 results and one draft demo snapshot. Counts alone are insufficient: verify no result lacks class/athlete/horse and no demo ranking graph links non-demo records.

## Test isolation and destructive-test policy

- Integration/constraint tests use a dedicated local test database or deterministic uniquely prefixed test IDs.
- Test setup checks `NODE_ENV=test` and validates the database name/host allowlist before any cleanup.
- Cleanup deletes only exact test-owned IDs in explicit dependency order.
- `deleteMany({})`, `TRUNCATE ... CASCADE`, `DROP SCHEMA public CASCADE` and `prisma migrate reset` are prohibited against the persistent development database.
- Seed idempotency is tested by running the exported seed operation twice and comparing target counts and stable keys.
- PostgreSQL constraint errors are asserted by known constraint/Prisma error codes, not brittle full error strings.

For continuous integration, use an ephemeral PostgreSQL 16 service with non-production credentials if database tests are added to the required gate. A fake `DATABASE_URL` is sufficient only for validation/generation/unit tests, not for proving FK/check/partial-index behavior.

## Roll-forward and failure handling

For the empty local v1 database, a failed unapplied create-only migration may be corrected before first application. Once applied/shared, do not rewrite it. Create a new corrective migration.

If application fails:

1. stop application writes and capture the migration name/error without exposing secrets;
2. inspect `_prisma_migrations` and actual schema state;
3. do not mark resolved until the database state is independently verified;
4. fix forward with a reviewed migration when data may exist;
5. use reset/recreate only for an explicitly verified disposable local database;
6. rerun clean-database migration, seed, constraint tests, lint, typecheck, unit/E2E tests and build.

Production rollback is not defined by this local procedure. Before production, every migration needs backup/PITR readiness, restore evidence, owner/on-call, monitoring, timeout/lock analysis and a roll-forward/rollback decision.

## Expand/backfill/validate/contract for later changes

After data exists, required or unique changes are not one-step operations:

1. **Expand:** add nullable/new structure without breaking old code.
2. **Backfill:** populate in bounded, observable batches with deterministic transformation.
3. **Validate:** report nulls, duplicates, normalization collisions, invalid references and query impact.
4. **Constrain:** add `CHECK ... NOT VALID`/validate or index concurrently when operationally appropriate.
5. **Contract:** remove old columns/paths only after all readers/writers migrate and rollback window closes.

Identifier renormalization always includes normalization-version rollout and collision report before canonical values or uniqueness change.

## Prisma Studio review

Prisma Studio is a local inspection tool, not a migration or bulk-edit workflow. Bind it only for local access, do not expose it to a public network, and do not connect it to production. Use it to inspect the seeded relations and draft/demo flags; validate constraints through automated PostgreSQL tests rather than manual edits.

## Final gate

The migration is accepted only when all commands succeed on Node.js 22 with pnpm:

```bash
pnpm db:up
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run the real-database constraint suite, repeat seed, verify migration deployment on a clean disposable PostgreSQL 16 database and inspect the demo data through local Prisma Studio. Any skipped check must be reported explicitly; it cannot be described as passed.

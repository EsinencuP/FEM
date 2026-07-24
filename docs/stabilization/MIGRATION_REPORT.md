# Migration report

Updated: 2026-07-24
Status: **Stage 2 clean remediation replay PASS; independent verdict pending**

## Migration history

1. `20260722201238_initial_database_v1`
2. `20260722204033_mvp_database_stabilization`
3. `20260723234136_admin_security`
4. `20260723235000_admin_security_constraints`
5. `20260724093000_admin_session_hardening`
6. `20260724094500_session_rotation_grace`
7. `20260724100000_postgres_rate_limit`
8. `20260724101500_admin_idempotency`
9. `20260724103000_optimistic_versions`
10. `20260724104500_admin_permissions`
11. `20260724110000_version_override_permission`
12. `20260724111000_runtime_database_role`
13. `20260724112000_runtime_role_hardening`

The original two migrations were not rewritten. Stage 2 is additive:
credentials/sessions/recovery, append-only audit hardening, shared rate-limit
buckets, idempotency records, mutable-resource versions, persisted permissions,
an explicit version-override capability and a restricted runtime database role.
The final hardening migration replaces the legacy cluster-global grant with a
database-scoped capability and an explicit least-privilege table matrix.

## Current evidence

- Prisma format, validate and generate pass.
- The first ten migrations deployed in order to the existing isolated
  `fem_audit_release_stage1` database.
- All thirteen migrations deployed from empty PostgreSQL to the isolated
  `fem_audit_release_stage2_gate5` database after final runtime-role migration
  hardening.
- Demo seed ran three times with identical summaries: 5 countries, 1
  federation, 3 disciplines, 3 clubs, 10 athletes, 12 horses, 5 owners, 3
  events, 8 classes, 36 results and 1 ranking snapshot.
- On the clean database, migration status is up to date; 69 unit, 25 DB and 67
  E2E tests pass, followed by build, OpenAPI and compiled restricted-runtime
  HTTP smoke.
- No migration targets a production or remote database.
- No `prisma db push` or migration-history reset was used.
- SQL contains no application-table DROP.
- Security foreign keys use `RESTRICT`; technical rows have reviewed ownership.
- The permission migration adds fixed system vocabulary and assigns it only to
  an existing `ADMIN` role; it creates no human account or credential.
- Migrations 11–13 are additive independent-review remediations. The runtime
  capability has no access to `_prisma_migrations`, cannot mutate permission
  configuration or AuditLog, cannot own/create public objects and must be the
  expected database-scoped role. Runtime startup also enforces exact membership
  options, effective table/column ACL, no grant options and no unexpected user
  schema, view, function or sequence access. The migration removes application
  surface and database access from `PUBLIC`; startup compares explicit
  application/system ACL provenance and PostgreSQL initial privileges.
- Adversarial clean migration tests pre-create malicious LOGIN,
  ownership/default-ACL capabilities and prove the first role migration fails
  before issuing grants. A future table/sequence receives no runtime access
  until an explicit migration grant is issued.
- The three unpublished remediation migrations (11–13) were revised before any
  production or shared-environment deployment after independent review found
  an unsafe intermediate blanket grant. Database v1 and all earlier published
  migration files were not rewritten.

## Residual operational work

- Production-sized upgrade timing and lock measurement require a staging copy
  and approved deployment window.
- Backup/restore and rollback rehearsal belong to the final deployment gate.
- Prisma 6 warns that `package.json#prisma` seed configuration will be removed
  in Prisma 7; moving to `prisma.config.ts` is deferred to a reviewed major
  upgrade.

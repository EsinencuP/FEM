# Security findings

Updated: 2026-07-24
Admin Protection status: **IMPLEMENTED, independent gate pending**
Whole public release status: **NO-GO until Stages 3–6**

## Closed Stage 2 blockers

- All domain routes moved to `/api/v1/admin/*`; anonymous requests receive 401.
- Password authentication uses Argon2id and TOTP/recovery 2FA.
- Opaque PostgreSQL-backed sessions enforce absolute/idle expiry, rotation,
  logout, other-session revocation and token-reuse response.
- Persisted `Permission`/`RolePermission` separates authorization from the
  `ADMIN` role. Guards enforce Admin read/write, audit read and own-security
  permissions on every request.
- Session-bound CSRF protects state changes.
- Exact credentialed CORS, Helmet, explicit proxy trust, optional HSTS and a
  100 KiB body limit are configured centrally.
- PostgreSQL-backed named throttles replace per-process counters; a two-instance
  test proves the auth quota is shared.
- Admin writes and redacted audit events are atomic. Database triggers make the
  audit table append-only.
- Admin POST is idempotent by key and payload; Admin PATCH uses numeric
  optimistic versions.
- Critical actions require explicit confirmation and a reason.
- Production Swagger fails closed unless disabled or protected by separate
  Basic credentials.

## Adversarial regressions

- TOTP timestep reuse is rejected under concurrent login and sensitive actions.
- Recovery code consumption and TOTP re-enrollment confirmation have a single
  concurrent winner.
- A recovery-factor session cannot access domain Admin routes before successful
  TOTP re-enrollment confirmation or a separate normal TOTP login.
- Password change revokes other sessions but preserves the current session.
- Idle-expired and revoked sessions cannot access protected routes.
- Removing `ADMIN_READ` while retaining `ADMIN` produces 403.
- Spoofed `X-Forwarded-For` is ignored when no proxy is trusted.
- Audit insert failure rolls the associated domain write back.
- Stale same-version PATCH produces one success and one 409.
- Same idempotency key with a different payload returns 409.

## Remaining release blockers outside Stage 2

1. Stage 3 published-only Public API and strict public field allowlists.
2. Stage 4 CMS publication, translation, revision, media and preview workflows.
3. External staging HTTPS/proxy/CORS validation.
4. Secret-manager, backup/restore, monitoring/alerting and production
   deployment evidence.
5. Final dependency, container, performance and regression audits.

## Protective properties retained

- Strict Zod objects reject undeclared system fields.
- Services construct Prisma payloads explicitly.
- No user-controlled raw SQL was found.
- Unknown exceptions do not expose stack traces.
- Pino redacts authorization, cookie, password, token and secret fields.
- Test/database guards reject non-local and non-test targets.

The detailed contract and operational rules are in
`docs/delivery/ADMIN_API_SECURITY.md`. No whole-product GO is claimed here.

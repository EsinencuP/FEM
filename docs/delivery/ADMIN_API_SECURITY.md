# Admin API security

Status: Stage 2 implementation candidate  
Updated: 2026-07-24  
Applies to: `/api/v1/admin/*` and protected `/api/v1/auth/*`

## Boundary

All domain administration routes are under `/api/v1/admin/*`. No legacy
unauthenticated write route is registered. Authentication routes are under
`/api/v1/auth`; only `POST /login` is anonymous. Public read projections are a
separate Stage 3 concern and must not reuse Admin serializers.

## Authentication

- Passwords use Argon2id (`memoryCost=19456`, `timeCost=2`, `parallelism=1`).
- The second factor is TOTP or a one-time recovery code.
- TOTP secrets are encrypted with `AUTH_ENCRYPTION_KEY`; password, cookie,
  CSRF, recovery and previous-session tokens are never stored in plaintext.
- Sessions are opaque random tokens persisted as SHA-256 hashes in PostgreSQL.
- Browser cookie is `HttpOnly`, `SameSite=Strict`, path-scoped to the API and
  `Secure` in production.
- Absolute and idle expiration are both enforced. Session refresh rotates the
  cookie and CSRF token. A five-second previous-token grace prevents false
  positives between concurrent browser requests; later reuse revokes the
  session and creates an audit event.
- Failed known-account logins are counted atomically. The configured threshold
  creates a timed lock. Unknown accounts perform a dummy Argon2 verify.
- A TOTP timestep can be claimed once. Login, password change, recovery-code
  rotation and TOTP re-enrollment use transactional single-use checks.
- Recovery login is deliberately restricted: it can start one two-step TOTP
  re-enrollment after current-password verification. Confirmation rotates
  recovery codes and revokes other sessions.

## Authorization

Authentication and authorization are separate.

| Permission | Default use |
| --- | --- |
| `ADMIN_READ` | GET/HEAD under `/api/v1/admin/*` |
| `ADMIN_WRITE` | POST/PATCH/DELETE under `/api/v1/admin/*` |
| `AUDIT_READ` | immutable audit list/detail |
| `SECURITY_SELF` | current administrator session/password/2FA lifecycle |

`Permission` and `RolePermission` are persisted models. The `ADMIN` bootstrap
role receives all four system permissions. Guards resolve active role and
permission assignments on every request, so removing a permission takes effect
without waiting for session expiry.

## Browser request controls

- Exact origins come from `CORS_ALLOWED_ORIGINS`; wildcard is rejected and
  production origins must be HTTPS.
- Credentialed CORS allows only documented headers, including
  `X-CSRF-Token`, `If-Match`, `Idempotency-Key`, `X-Confirm-Action`,
  `X-Action-Reason` and `X-Request-Id`.
- Every state-changing protected request requires the session-bound CSRF token.
- Every Admin POST requires an `Idempotency-Key` of 8–128 safe characters.
- Every Admin PATCH requires `If-Match: <positive version>`.
- `If-Match: *` is an explicit operator override and requires confirmation plus
  a reason; it is not the normal frontend path.
- Archive, restore and DELETE also require `X-Confirm-Action: true` and an
  `X-Action-Reason` containing 3–500 characters.
- Body size is limited to 100 KiB and Helmet removes the framework fingerprint.
- HSTS is enabled only by explicit `HSTS_ENABLED=true` after HTTPS termination
  has been verified. `TRUST_PROXY_HOPS` is an explicit integer, not a trust-all
  switch.

## Rate limiting

Rate-limit counters are stored in PostgreSQL, so quotas are shared between
instances and survive application restarts. Separate named policies exist for
default, auth, Admin, Public, search, files and integrations. Limits are
configured through validated environment variables. Spoofed forwarding headers
do not change the client identity when `TRUST_PROXY_HOPS=0`.

The PostgreSQL store is adequate for the current deployment scale. A distributed
cache can replace it later only with equivalent atomicity, expiry, multi-instance
tests and failure policy.

## Audit and write integrity

- Domain Admin writes and their audit event execute in one serializable
  transaction. Audit insert failure rolls the domain write back.
- Audit contains actor, session, request ID, action, entity, redacted old/new
  data and reason where applicable.
- Passwords, tokens, cookies, TOTP secrets and recovery codes are redacted.
- PostgreSQL triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on `AuditLog`.
- `AuditLog` actor/session foreign keys use `RESTRICT`.
- Audit API is read-only and requires `AUDIT_READ`.
- Idempotency records are written in the same transaction as the domain change
  and audit. Same key plus same payload replays the original response; a
  different payload returns 409.
- Mutable resources expose `version`. A stale numeric `If-Match` returns
  `409 STALE_VERSION`; exactly one of concurrent same-version writes succeeds.

## Auth endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | password plus TOTP/recovery login |
| POST | `/api/v1/auth/refresh` | rotate session and CSRF |
| GET | `/api/v1/auth/me` | current identity, roles and permissions |
| GET | `/api/v1/auth/sessions` | own session inventory |
| POST | `/api/v1/auth/logout` | revoke current session |
| DELETE | `/api/v1/auth/sessions/:sessionId` | revoke another own session |
| POST | `/api/v1/auth/password` | password change and other-session revocation |
| POST | `/api/v1/auth/recovery-codes` | rotate one-time recovery codes |
| POST | `/api/v1/auth/totp/re-enrollment` | start recovery-only re-enrollment |
| POST | `/api/v1/auth/totp/re-enrollment/confirm` | confirm and rotate codes |

## Bootstrap

`pnpm admin:bootstrap` is fail-closed unless `ALLOW_ADMIN_BOOTSTRAP=true`.
`INITIAL_ADMIN_EMAIL`, display name, password and Base32 TOTP secret are
process-local secrets. The script refuses to overwrite an existing credential,
creates permissions and role mappings transactionally, records
`ADMIN_BOOTSTRAPPED`, and displays recovery codes once.

## Production rules

1. Generate a unique encryption key and credentials in the deployment secret
   manager; never bake them into an image.
2. Keep `ALLOW_ADMIN_BOOTSTRAP=false` during normal operation.
3. Disable Swagger or protect it with separate Basic credentials.
4. Configure exact HTTPS CORS origins and the exact reverse-proxy hop count.
5. Terminate HTTPS before enabling HSTS and Secure-cookie browser use.
6. Alert on lockouts, token reuse, repeated 401/403/429, audit failures and
   database unavailability.
7. Do not claim release readiness until external staging, backup/restore and
   monitoring gates are evidenced.

## Automated evidence

- `test/auth.e2e-spec.ts`
- `test/auth-lifecycle.e2e-spec.ts`
- `test/auth-hardening.e2e-spec.ts`
- `test/auth-lockout.e2e-spec.ts`
- `test/rate-limit.e2e-spec.ts`
- `test/swagger-protection.e2e-spec.ts`
- `test/audit-prefix.e2e-spec.ts`
- `test/concurrency.e2e-spec.ts`
- `test/database-constraints.db-spec.ts`
- `test/openapi.e2e-spec.ts`

The Stage 2 gate also requires clean migration replay, full unit/DB/E2E,
OpenAPI checksum, build, compiled runtime smoke and independent review.

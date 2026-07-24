# Security Findings

Status: **NO-GO for public deployment**

## Deployment blocker

All 53 initial write operations are unauthenticated and unprotected. The
repository intentionally excludes authentication in the current scope.
Therefore the API must remain local/private and must not be Internet-exposed.

## Critical findings

1. Admin-like reads returned draft and internal data because no Public API
   projection exists.
2. Generic competition/result DTOs initially allowed direct publication
   changes; they now fail closed.
3. External identifier DTOs allowed fabricated verification provenance.
4. Critical writes do not create application AuditLog entries.

Identifier provenance has been narrowed to server-owned `UNVERIFIED` creation.
Publication authority, public-field allowlists and actor-attributed audit remain
blocked by the authentication/permissions business decision.

## High findings

- No rate limiting.
- OpenAPI has no security scheme; structural success contracts now exist, but
  resource property typing remains incomplete.
- Archived parents were usable in child writes.
- Oversized JSON returned 500.
- Correlation ID was absent from errors.
- Standard E2E could point at the development DB.

Cycle 4 corrected archive/reference transactions, request size/error handling,
correlation in errors, E2E isolation and structural OpenAPI. Rate limiting,
public/admin separation, authentication and atomic application audit remain
blocked or deferred.

## Confirmed protective properties

- Strict Zod objects reject undeclared system fields.
- Services construct Prisma payloads explicitly.
- No user-controlled raw SQL was found.
- Unknown exceptions do not expose stack traces.
- Pino redacts authorization, cookie, password and token fields.
- Production dependency audit reported no known high vulnerabilities.

Security status: **NO-GO for public deployment**.

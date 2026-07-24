# Frontend API matrix

Version: 1.0-draft  
Updated: 2026-07-24  
Owner: backend contract

## Purpose

This is the single compatibility map between the FEM backend and its future
public and administrative frontends. Frontend code is not part of the current
repository; this document fixes what a generated client may rely on.

The newest release program uses different stage numbers from
`DEVELOPMENT_PLAN.md`. This document therefore uses names:

- **Release Program Stage 1** — Frontend Integration Readiness;
- **Delivery Stage 1** — Public API foundation;
- **Release Program Stage 3** — implementation of the complete Public API.

## Global contract

| Concern | Contract |
| --- | --- |
| Base path | `/api/v1` |
| Health | `/api/health` |
| Swagger UI | `/api/docs` |
| OpenAPI JSON | `/api/docs-json` |
| Encoding | JSON, UTF-8 |
| Single resource | `{ "data": { ... } }` |
| Paginated list | `{ "data": [], "meta": { "page", "limit", "total", "totalPages" } }` |
| Page defaults | `page=1`, `limit=20`, maximum `limit=100` |
| Stable ordering | requested allowlisted field, then `id` |
| Errors | `statusCode`, `error`, `message`, `code`, `details`, `timestamp`, `path`, `requestId` |
| Request correlation | request and response header `X-Request-Id`; error body `requestId` |
| CORS | exact origins from `CORS_ALLOWED_ORIGINS`; wildcard is rejected |
| Unknown fields | rejected by strict Zod schemas |
| Request dates | ISO `YYYY-MM-DD`; Zod rejects invalid calendar dates |
| Response dates | Prisma serializes PostgreSQL `date` values as ISO 8601 UTC timestamps at midnight |
| Decimal values | JSON strings, preserving database precision |
| Archive | archive/restore commands; no physical delete for primary resources |
| Authentication | opaque HttpOnly session cookie + TOTP/recovery 2FA |
| Authorization | persisted role permissions; Admin read/write, audit read and own-security permissions |
| CSRF | `X-CSRF-Token` on protected state changes |
| POST replay safety | `Idempotency-Key` required on `/api/v1/admin/*` POST |
| PATCH concurrency | numeric `If-Match` required; resource body exposes `version` |

## Current resource surface

The routes below are the protected domain surface. Release Program Stage 3 will
add published-only `/api/v1/public/{lang}` projections. Admin and Public DTOs
remain separate contracts.

| Resource | Base route | Operations | List filters | Sort allowlist |
| --- | --- | --- | --- | --- |
| Countries | `/admin/countries` | list, get, create, patch, archive, restore | search, archived | name, isoAlpha2, isoAlpha3, createdAt |
| Disciplines | `/admin/disciplines` | list, get, create, patch, archive, restore | search, status, archived | name, code, createdAt |
| Clubs | `/admin/clubs` | list, get, create, patch, archive, restore, identifiers | search, countryId, federationId, status, archived | name, createdAt, updatedAt |
| Owners | `/admin/owners` | list, get, create, patch, archive, restore | search, countryId, status, archived | displayName, createdAt |
| Athletes | `/admin/athletes` | list, get, create, patch, archive, restore, clubs, horses, results, identifiers | search, countryId, federationId, clubId, status, archived | lastName, displayName, createdAt, updatedAt |
| Horses | `/admin/horses` | list, get, create, patch, archive, restore, owners, athletes, results, identifiers | search, sex, breed, color, birthYear, countryOfBirthId, status, archived | displayName, passportName, birthYear, createdAt |
| Competitions | `/admin/competitions` | list, get, by-slug, create, patch, archive, restore, classes, results | search, countryId, disciplineId, status, publicationStatus, dateFrom, dateTo, upcoming, archived | startDate, endDate, title, createdAt |
| Competition classes | `/admin/competition-classes` | list, get, create, patch, archive, restore, results | competitionEventId, disciplineId, category, level, status, competitionDate, archived | competitionDate, sortOrder, title, createdAt |
| Results | `/admin/results` | list, get, create, patch, archive, restore, metric create/patch/delete | competitionEventId, competitionClassId, athleteId, horseId, disciplineId, statusId/statusCode, publicationStatus, hasRank, archived | rank, points, timeSeconds, penalties, createdAt |

All paths in this table are relative to `/api/v1`.

## OpenAPI resource schemas

Every successful domain operation references a named component:

- `Country`;
- `Discipline`;
- `Club`;
- `Owner`;
- `Athlete`;
- `Horse`;
- `CompetitionEvent`;
- `CompetitionClass`;
- `CompetitionResult`;
- `ResultMetric`;
- `ExternalIdentifier`;
- temporal relation resources.

Named `<Resource>Response` and `<Resource>ListResponse` envelopes prevent the
former untyped `additionalProperties` contract from becoming frontend types.
Detail projections may add documented relations; public DTOs will use a
strict, separate allowlist in Release Program Stage 3.

## Compatibility rules

1. Existing fields are not removed or retyped inside API v1 without a recorded
   breaking-change decision.
2. New optional fields are additive.
3. New required request fields require a transition plan or a new API version.
4. `sortBy` remains an allowlist; frontend must not send arbitrary database
   field names.
5. Error `code` is the programmatic discriminator; `message` is user-readable
   but not a stable switch key.
6. Public and Admin DTOs are separate even when they call the same domain
   service.
7. Frontend-generated types must come from the committed OpenAPI snapshot, not
   handwritten copies.
8. Frontend stores neither the session token nor recovery codes in browser
   storage. The cookie is managed by the browser; the CSRF token is kept only
   for the current authenticated runtime.
9. PATCH reads the latest `version` and sends it in `If-Match`; a 409 requires
   refresh and user-visible conflict handling, not a blind retry.
10. POST retries reuse the same `Idempotency-Key` only for the exact same
    payload.

## Stage 1 evidence

- validated exact-origin CORS configuration;
- `/api/v1` versioned route inventory;
- shared success/error/pagination contracts;
- resource-specific OpenAPI components;
- contract tests that reject generic resource schemas;
- a generated OpenAPI snapshot and checksum (after the Stage 1 gate).

## Deferred to required later stages

- public locale, allowlists, published-only routes and cache headers: Stage 3;
- content/news/pages/navigation/media/SEO contracts: Stage 4;
- full frontend contract consumer test: external frontend pipeline;
- staging UAT: release gate with the FEM product owner.

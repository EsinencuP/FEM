# API contract audit

Updated: 2026-07-24
Stage 1 contract: **STRICT GO**
Stage 2 contract: **STRICT GO**
Stage 3 Public contract: **implemented; full regression/review gate pending**

## Runtime inventory

- Global prefix: `/api`; versioned application routes: `/api/v1`.
- Domain namespace: `/api/v1/admin/*`.
- Authentication: `/api/v1/auth/*`.
- Audit: `/api/v1/admin/audit-logs`.
- Public sports projection: `/api/v1/public/{ro|ru}/*`.
- OpenAPI currently covers 115 operations including authentication, audit,
  publication commands and 14 Public GET operations.
- Health remains the bare `/api/health` operational contract.

## Stable frontend contracts

- typed `{data}` and `{data,meta}` envelopes;
- allowlisted sort/filter fields and stable ID tie-break;
- strict DTOs reject unknown/system fields;
- safe correlated error envelope;
- named resource/detail/list/relation schemas;
- UUID path metadata and 100 KiB/413 documentation;
- credentialed exact-origin CORS;
- cookie security scheme plus 401/403/429;
- Admin POST `Idempotency-Key`;
- Admin PATCH numeric `If-Match` and resource `version`;
- critical-action confirmation/reason headers.
- separate named `Public*` response schemas, no Admin DTO reuse;
- Public ETag/304/cache/language headers and anonymous `security: []`.

## Security separation

No unauthenticated domain write route is registered. Admin serializers contain
internal/draft fields and are not reused by Public API responses. Stage 3 uses
distinct published-only locale-aware Prisma selects and response components.

Generic competition/result mutation rejects publication fields. Dedicated
protected, confirmed, versioned and audit-atomic publish/withdraw commands are
the only supported publication transition.

## Gate

The OpenAPI E2E contract is green. The committed snapshot/checksum is refreshed
after each accepted contract shape and checked in CI. Public Internet exposure
remains NO-GO until the remaining CMS/integration/production gates pass.

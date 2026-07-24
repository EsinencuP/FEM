# API Contract Audit

Status: **CONDITIONAL PASS for private MVP development; NO-GO for Internet exposure**

## Runtime inventory

- Controllers: 10.
- Operations: 85 across 59 OpenAPI paths.
- Write operations: 53.
- Authentication/security schemes: 0.
- Public routes: 0.
- Protected admin namespace: 0.

## Corrected contract defects

- Literal query `false` is no longer coerced to `true`.
- Generic update DTOs reject `{}` and unknown fields.
- A result requires a direct outcome or at least one valid metric.
- Oversized and malformed JSON return correlated 413/400 envelopes.
- All 85 operations have an explicit 2xx response contract.
- Existing explicit contracts are preserved: health remains a bare
  `HealthResponseDto`, not a `{data}` envelope.
- Nested identifier GET routes are classified as list envelopes.
- DELETE ResultMetric is explicitly documented as 204.

The OpenAPI E2E suite verifies operation count, 2xx coverage, reusable
pagination metadata, typed health and nested-list classification.

## Residual contract limitations

- Resource properties inside `DataEnvelope` and `ListEnvelope` remain open
  objects. This is a documented MEDIUM limitation for generated clients.
- No public/admin split exists. Current `/api/v1` reads are administrative-like
  and may return draft, archived or internal fields when requested.
- No 401/403 contract exists because authentication and roles are explicitly
  outside this stabilization scope.
- Publication is fail-closed: generic competition/result DTOs reject
  publication fields, but no authenticated publish command exists.
- Optimistic locking and idempotency-key semantics require a client contract.

## Decision

The structural Swagger/runtime mismatch is fixed for the private MVP. Explicit
resource response DTOs must be designed together with public allowlists and the
protected admin API. Until then the API is unsuitable for public or
administrative production integration.

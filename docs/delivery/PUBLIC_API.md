# Public API contract

Version: 1.0  
Updated: 2026-07-24  
Status: implemented; clean gate passed, independent re-review pending

## Boundary

The Public API is an unauthenticated, read-only projection for the future public
frontend. It is not a renamed Admin API. Every query uses an explicit Prisma
`select` and a fail-closed visibility predicate before data is returned.

Base path:

```text
/api/v1/public/{lang}
```

Supported provisional locales are `ro` and `ru`. The locale is mandatory,
lowercase and returned as `Content-Language`. Sports reference fields are
currently language-neutral because the database has no translation model.
There is no machine translation or silent fallback.

## Routes

| Method | Route                              | Contract                                  |
| ------ | ---------------------------------- | ----------------------------------------- |
| GET    | `/{lang}/countries`                | visible country reference list            |
| GET    | `/{lang}/disciplines`              | visible discipline list                   |
| GET    | `/{lang}/clubs`                    | public club directory                     |
| GET    | `/{lang}/clubs/{id}`               | public club profile                       |
| GET    | `/{lang}/athletes`                 | public athlete directory                  |
| GET    | `/{lang}/athletes/{id}`            | public athlete profile                    |
| GET    | `/{lang}/horses`                   | public horse directory                    |
| GET    | `/{lang}/horses/{id}`              | public horse profile                      |
| GET    | `/{lang}/competitions`             | published competition calendar/archive    |
| GET    | `/{lang}/competitions/{slug}`      | published competition by immutable slug   |
| GET    | `/{lang}/competition-classes`      | visible classes of published competitions |
| GET    | `/{lang}/competition-classes/{id}` | visible competition class                 |
| GET    | `/{lang}/results`                  | published competition results             |
| GET    | `/{lang}/results/{id}`             | one published result                      |

Owners, ownership history, external identifiers, ranking snapshots, source
documents and raw media metadata are not public. Content/news/pages/navigation
and safe media delivery belong to Stage 4.

## Visibility

All public rows are non-demo and non-archived. Country, discipline, club,
athlete and horse rows additionally require an explicit
`publicationStatus=PUBLISHED` decision and a non-future `publishedAt`.
Status-bearing sports/reference rows allow `ACTIVE` and `INACTIVE`; `DRAFT`
and `ARCHIVED` are hidden. This provisional lifecycle choice preserves
explicitly published historical profiles/results while still failing closed
for drafts. It must be confirmed by the product owner.

A competition is visible only when:

- its status is public;
- `publicationStatus=PUBLISHED`;
- `publishedAt` is present and not in the future;
- its optional country reference is public.

A class additionally requires a visible parent competition and discipline. A
result additionally requires its own published timestamp and a visible class,
event, discipline, athlete, horse and optional result status. List, count,
filter and detail paths use the same predicates. Hidden and unknown detail
resources return the same `404 NOT_FOUND`.

## Public allowlists

Allowed projections are:

- country: opaque UUID, ISO codes and name;
- discipline: opaque UUID, code, name and description;
- club: opaque UUID, name, country and federation summaries;
- athlete: opaque UUID, first/last/display name, country and federation;
- horse: opaque UUID, public sport name/descriptors, birth year and country of
  birth; exact birth date is excluded;
- competition: opaque UUID, stable slug, public descriptive/location/date
  fields, publication timestamp and country;
- class: opaque UUID, title/category/level/date/order, discipline and event
  summary;
- result: opaque UUID, public outcome fields, subject/class/status summaries
  and ordered metrics.

Never returned:

- `version`, `isDemo`, `archivedAt`, internal timestamps;
- exact athlete/horse date of birth and athlete gender;
- source document/reference and approval actors;
- audit/import metadata;
- storage keys/checksums;
- external identifier normalization or verification metadata;
- owner/relationship history.

Decimal values remain JSON strings to preserve PostgreSQL precision.

## Query contract

Every list uses:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

`page` starts at 1, `limit` defaults to 20 and is capped at 100. Page overflow
returns `200` with an empty `data` array and accurate metadata. All sorts use an
allowlisted field followed by `id`; nullable fields use nulls-last ordering.
Unknown query fields are rejected by strict Zod schemas.

Filters and sort allowlists are published in Swagger and
`FRONTEND_API_MATRIX.md`.

## Publication commands

Ordinary Admin create/update DTOs cannot set publication fields. The protected,
CSRF/version/reason/audit-controlled commands are:

```text
PATCH /api/v1/admin/competitions/{id}/publish
PATCH /api/v1/admin/competitions/{id}/withdraw
PATCH /api/v1/admin/results/{id}/publish
PATCH /api/v1/admin/results/{id}/withdraw
PATCH /api/v1/admin/countries/{id}/publish
PATCH /api/v1/admin/countries/{id}/withdraw
PATCH /api/v1/admin/disciplines/{id}/publish
PATCH /api/v1/admin/disciplines/{id}/withdraw
PATCH /api/v1/admin/clubs/{id}/publish
PATCH /api/v1/admin/clubs/{id}/withdraw
PATCH /api/v1/admin/athletes/{id}/publish
PATCH /api/v1/admin/athletes/{id}/withdraw
PATCH /api/v1/admin/horses/{id}/publish
PATCH /api/v1/admin/horses/{id}/withdraw
```

They require `If-Match`, `X-Confirm-Action: true` and `X-Action-Reason`.
Publication is recorded atomically as `PUBLISH`/`WITHDRAW` in `AuditLog`.
Published competition slugs are immutable. Published results must be withdrawn
before correction; withdrawn results may be corrected and republished.
Published profiles must likewise be withdrawn before ordinary changes.
Publishing a profile, event or result verifies the complete public dependency
chain in the same serializable transaction. Demo records cannot be published.

## Cache and frontend integration

- all successful Public responses use
  `public, max-age=0, s-maxage=0, must-revalidate`;
- Express produces representation ETags and honors `If-None-Match` with `304`;
- CORS allows `If-None-Match` and exposes cache/language/ETag headers;
- errors use `Cache-Control: no-store`;
- `Vary` includes `Origin` and `Accept-Encoding`.

This deliberately conservative policy prevents archive/withdraw from being
served stale before a deployment-specific purge mechanism exists.
Surrogate-key purge and positive shared-cache TTLs remain deployment work.

## Stable URL policy

Competition pages use the existing immutable-after-publication slug. Athlete,
horse, club, class and result routes use opaque UUIDs. These UUIDs are not FEI,
national, licence, passport or microchip identifiers. Profile slugs may be
added later as an additive contract; existing v1 UUID routes must remain valid.

## Evidence

`test/public-api.e2e-spec.ts` verifies:

- anonymous access and no cookie issuance;
- exact field leakage denylist;
- exact top-level allowlists for every public resource;
- draft/demo/archive and full ancestor visibility closure;
- same 404 contract for hidden and unknown records;
- locale, pagination, filters, combined filters and null ordering;
- publication/withdraw/correction/audit lifecycle;
- ETag/304 and conditional-request CORS;
- the independent Public rate-limit contour.
- explicit profile publication, withdrawal and immutable-while-published
  workflows.

`test/openapi.e2e-spec.ts` verifies named Public schemas, locale parameters,
anonymous OpenAPI security, strict object schemas, cache/conditional-request
headers and the complete route inventory. All Public list `data` and
`meta.total` queries execute under PostgreSQL `REPEATABLE READ`.

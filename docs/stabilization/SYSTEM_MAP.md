# Stabilization System Map

Status: updated through Stage 2 candidate

## Runtime composition

`main.ts` creates `AppModule`, installs the global `/api` prefix, Zod validation,
`ApiExceptionFilter`, Pino logging and Swagger. `DatabaseModule` exposes one
global `PrismaService`.

Registered modules:

- Auth and permissions;
- read-only Audit;
- Health;
- Countries;
- Disciplines;
- Clubs;
- Owners;
- Athletes;
- Horses;
- Competitions;
- Competition Classes;
- Competition Results;
- External Identifiers as a shared nested service.

The refreshed Stage 2 Graphify map reports 1,911 nodes, 3,785 edges and 132
communities with no import cycle. Graphify identifies
`withSerializableTransaction`, `dataResponse`, `PrismaService`,
`AppConfigService`, `AthletesService` and `AuthService` as the highest-connected
nodes. These are navigation/risk hypotheses and were confirmed against source
and tests rather than treated as proof.

## Data-to-API paths

- `Athlete` → `AthletesService` → `AthletesController`.
- `Horse` → `HorsesService` → `HorsesController`.
- `CompetitionEvent` → `CompetitionsService` → `CompetitionsController`.
- `CompetitionClass` → `CompetitionClassesService` →
  `CompetitionClassesController`.
- `CompetitionResult` / `ResultMetric` → `CompetitionResultsService` →
  `CompetitionResultsController`.
- `AdminSessionGuard` → `PermissionsGuard` → `CsrfGuard` protects Admin/Auth
  operations.
- `RequestAuditContext` → serializable transaction → domain change,
  `AuditLog`, version claim and optional `IdempotencyRecord`.
- All services use the shared `PrismaService`; controllers do not query Prisma
  directly.

## Shared API components

- pagination: `PaginationQueryDto`, `paginationArgs`, `archivedAtFilter`;
- validation: DTO-owned strict Zod schemas and one global pipe;
- responses: `dataResponse` and `listResponse`;
- errors: one global Prisma/HTTP exception filter;
- logging: `nestjs-pino`, request ID header and structured request duration;
- authentication: opaque hashed session, encrypted TOTP, hashed recovery code;
- authorization: active Role/UserRole plus Permission/RolePermission;
- rate limiting: PostgreSQL shared named buckets;
- write safety: CSRF, idempotency, optimistic version and critical confirmation;
- docs: runtime Swagger at `/api/docs`, JSON at `/api/docs-json`.

## Missing API surfaces

- no complete Public API projection;
- no Integration/Internal API;
- no content/news/pages/media/SEO/search/navigation API.

## Tests

- unit tests cover env, health, filters, validation and DTO matrices/fuzz;
- DB constraint suite directly uses Prisma and contains destructive cleanup
  limited by deterministic test IDs;
- HTTP E2E covers Admin CRUD, security, audit, concurrency, failure recovery,
  OpenAPI and pagination;
- Public publication boundaries remain Stage 3 work.

## Current risk centers

- `PrismaService`: natural database gateway;
- `AthletesService` and `HorsesService`: historical relations and archive paths;
- `CompetitionsService`: parent-date and publication invariants;
- `CompetitionResultsService`: references, metrics and publication;
- `ExternalIdentifiersService`: application-enforced polymorphic integrity;
- `AuthService`: credential/session/factor lifecycle;
- shared serializable transaction: audit, idempotency and optimistic versions;
- PostgreSQL rate-limit bucket cleanup/availability;
- `prisma/seed.ts`: large guarded serializable multi-model operation;
- integration-test database guard and environment isolation.

# Stabilization System Map

Status: discovery in progress

## Runtime composition

`main.ts` creates `AppModule`, installs the global `/api` prefix, Zod validation,
`ApiExceptionFilter`, Pino logging and Swagger. `DatabaseModule` exposes one
global `PrismaService`.

Registered modules:

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

Graphify currently reports 1311 nodes, 2374 edges, 79 communities and no import
cycle. Graphify findings remain navigation hypotheses until confirmed in code.

## Data-to-API paths

- `Athlete` → `AthletesService` → `AthletesController`.
- `Horse` → `HorsesService` → `HorsesController`.
- `CompetitionEvent` → `CompetitionsService` → `CompetitionsController`.
- `CompetitionClass` → `CompetitionClassesService` →
  `CompetitionClassesController`.
- `CompetitionResult` / `ResultMetric` → `CompetitionResultsService` →
  `CompetitionResultsController`.
- All services use the shared `PrismaService`; controllers do not query Prisma
  directly.

## Shared API components

- pagination: `PaginationQueryDto`, `paginationArgs`, `archivedAtFilter`;
- validation: DTO-owned strict Zod schemas and one global pipe;
- responses: `dataResponse` and `listResponse`;
- errors: one global Prisma/HTTP exception filter;
- logging: `nestjs-pino`, request ID header and structured request duration;
- docs: runtime Swagger at `/api/docs`, JSON at `/api/docs-json`.

## Missing API surfaces

- no Public API projection;
- no separate Admin API namespace;
- no authentication/permissions/2FA by explicit current scope;
- no Integration/Internal API;
- no Bruno collection;
- no content/news/pages/media/SEO/search/navigation API.

## Tests

- unit tests focus on env, health, validation pipe and selected DTOs;
- DB constraint suite directly uses Prisma and contains destructive cleanup
  limited by deterministic test IDs;
- HTTP E2E currently checks health, paginated GET lists and excessive limit;
- write endpoints, transactions, concurrency, failure recovery and public
  publication boundaries are not yet covered.

## Current risk centers

- `PrismaService`: natural database gateway;
- `AthletesService` and `HorsesService`: historical relations and archive paths;
- `CompetitionsService`: parent-date and publication invariants;
- `CompetitionResultsService`: references, metrics and publication;
- `ExternalIdentifiersService`: application-enforced polymorphic integrity;
- `prisma/seed.ts`: large multi-model, non-transactional operation;
- integration-test database guard and environment isolation.

This map will be expanded with every controller, DTO field, transaction,
projection and test after the independent reviews finish.

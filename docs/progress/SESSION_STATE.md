# FEM session state

Updated: 2026-07-25

## Active scope

`FEM_MVP_ACCELERATED_PLAN.md` версии 3.0 — DB-first demo-MVP внутреннего
инструмента учёта. Этапы 0–6 завершены. Этап 7 завершён для
воспроизводимого локального production preview. Репозиторий подготовлен к
customer-demo на Vercel как два проекта: NestJS API и Vite demo-web с
same-origin API proxy. Реальное внешнее размещение ждёт авторизации владельца
Vercel и создания отдельной managed PostgreSQL demo-базы.

Public API не расширялся. Dashboard, public website, CMS, Excel, ranking,
owners UI и отдельные страницы классов/результатов не создавались.

## Gates

| Этап                    | Результат   | Доказательство                                                         |
| ----------------------- | ----------- | ---------------------------------------------------------------------- |
| 0 — demo contract       | PASS        | RU, visible fields, 4 provisional categories, 7 route/API mappings     |
| 1 — baseline            | PASS        | Node 22.23.1, Prisma, lint, typecheck, 70 unit, build                  |
| 2 — DB/data             | PASS        | clean PostgreSQL 16, 17 migrations, seed x3, DB 28/28                  |
| 3 — API contract        | PASS        | readable projections, OpenAPI/types checks, E2E 85/85                  |
| 4 — frontend foundation | PASS        | protected shell, API/auth client, reusable table/form/state UI         |
| 5 — minimal screens     | PASS        | 7 routes, real Admin API and demo DB end-to-end                        |
| 6 — integration/QA      | PASS        | browser QA, safe PATCH, URL state, pagination 1/100, no P0             |
| 7 — preview             | CONDITIONAL | Vercel config PASS; account login, Neon and deployed smoke are pending |

## Demo-web

Workspace: `apps/demo-web`.

Routes:

- `/login`;
- `/athletes`, `/athletes/:id`;
- `/horses`, `/horses/:id`;
- `/competitions`, `/competitions/:id`.

The competition workspace contains provisional category/class navigation and
the selected class results. There are no dashboard, owners, Public API or
standalone class/result screens.

## Integration fixes

- SameSite login uses the same `127.0.0.1` site for frontend and API; cookie
  protection was not weakened.
- Nested competition class/result reads send only the query fields accepted
  by their strict DTO.
- Countries, clubs and disciplines lookups use their factual contracts and do
  not exclude presentation DRAFT records.
- Frontend errors map 401/403/404/409/500 to safe text and retain requestId.

## Final verified gate

- Prisma format/validate/generate — PASS;
- backend ESLint / strict TypeScript / build — PASS;
- backend unit — 10 suites / 74 tests;
- DB — 2 suites / 28 tests;
- E2E — 12 suites / 85 tests;
- OpenAPI snapshot/checksum and generated types — PASS;
- demo-web ESLint / strict TypeScript / build — PASS;
- demo-web unit/component — 5 files / 18 tests;
- browser QA — PASS at 1280×800 and accessible 390×844;
- local production preview — PASS at `http://127.0.0.1:5173`.

Audit database: `fem_audit_demo_stage2_20260724223427`. Existing development
database was not reset or dropped.

Deployment audit database: `fem_audit_vercel_deploy_20260725`. All 17
migrations applied from zero; demo seed ran twice with stable counters; E2E
passed 12 suites / 85 tests. Static demo credentials and cryptographic inputs
are stored only in ignored `.env.vercel.local`.

Remote demo database: Neon project `fem-showcase`, database `fem_showcase`.
All 17 migrations are applied, the seed ran twice with stable counters and the
fixed administrator plus restricted runtime role are provisioned.

Production deployments:

- frontend: `https://fem-demo-web.vercel.app`;
- backend: `https://fem-demo-api.vercel.app`;
- both Vercel projects use Node.js 22.x;
- backend uses the pooled restricted database role;
- frontend uses the same-origin `/api/v1/:path*` rewrite.

## Current boundary

Local demo status: **GO**.

External demo status: **GO**. Production HTTPS smoke verified health, database
connectivity, Admin API protection, disabled Swagger, security headers, fixed
password plus TOTP login and the athlete, horse and competition workflows.

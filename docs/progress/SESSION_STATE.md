# FEM session state

Updated: 2026-07-24

## Active scope

`FEM_MVP_ACCELERATED_PLAN.md` версии 3.0 — DB-first demo-MVP внутреннего
инструмента учёта. Этапы 0–6 завершены. Этап 7 завершён для
воспроизводимого локального production preview; внешний HTTPS preview ждёт
доступа к контролируемому hosting/DNS/TLS и deployment secrets.

Public API не расширялся. Dashboard, public website, CMS, Excel, ranking,
owners UI и отдельные страницы классов/результатов не создавались.

## Gates

| Этап                    | Результат   | Доказательство                                                        |
| ----------------------- | ----------- | --------------------------------------------------------------------- |
| 0 — demo contract       | PASS        | RU, visible fields, 4 provisional categories, 7 route/API mappings    |
| 1 — baseline            | PASS        | Node 22.23.1, Prisma, lint, typecheck, 70 unit, build                 |
| 2 — DB/data             | PASS        | clean PostgreSQL 16, 17 migrations, seed x3, DB 28/28                 |
| 3 — API contract        | PASS        | readable projections, OpenAPI/types checks, E2E 85/85                 |
| 4 — frontend foundation | PASS        | protected shell, API/auth client, reusable table/form/state UI        |
| 5 — minimal screens     | PASS        | 7 routes, real Admin API and demo DB end-to-end                       |
| 6 — integration/QA      | PASS        | browser QA, safe PATCH, URL state, pagination 1/100, no P0            |
| 7 — preview             | CONDITIONAL | local production preview PASS; external HTTPS environment unavailable |

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
- backend unit — 10 suites / 70 tests;
- DB — 2 suites / 28 tests;
- E2E — 12 suites / 85 tests;
- OpenAPI snapshot/checksum and generated types — PASS;
- demo-web ESLint / strict TypeScript / build — PASS;
- demo-web unit/component — 2 files / 11 tests;
- browser QA — PASS at 1280×800 and accessible 390×844;
- local production preview — PASS at `http://127.0.0.1:5173`.

Audit database: `fem_audit_demo_stage2_20260724223427`. Existing development
database was not reset or dropped.

## Current boundary

Local demo status: **GO**.

External demo status: **CONDITIONAL GO**. Do not claim external readiness
until hosting access, HTTPS, exact deployed CORS, secret storage and protected
or disabled Swagger have been verified in a clean browser session.

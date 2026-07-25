# Текущий статус качества FEM

Дата проверки: 2026-07-25

Окружение: Windows 11, Node.js 22.23.1, pnpm 11.9.0,
PostgreSQL 16 Docker, Prisma 6.19.3

## Актуальный scope

Активный delivery scope задан `FEM_MVP_ACCELERATED_PLAN.md` версии 3.0:
DB-first demo-MVP внутреннего инструмента учёта. Уже реализованный Public API
сохраняется как технический актив и продолжает проходить regression tests, но
не является условием первого demo и не расширяется в текущем sprint.

В `apps/demo-web` реализован единственный защищённый React/Vite consumer
Admin API. Он покрывает только спортсменов, лошадей и соревнования с
вложенными классами/категориями и результатами.

## Последний полный backend gate

Проверка выполнена на отдельной локальной БД
`fem_audit_demo_stage2_20260724223427`.

| Проверка                        | Результат                                              |
| ------------------------------- | ------------------------------------------------------ |
| Docker PostgreSQL healthcheck   | PASS                                                   |
| Миграции с пустой PostgreSQL 16 | PASS, 17/17                                            |
| Demo seed                       | PASS, три последовательных запуска без роста счётчиков |
| Prisma format/validate/generate | PASS                                                   |
| ESLint                          | PASS                                                   |
| TypeScript strict typecheck     | PASS                                                   |
| Unit tests                      | PASS, 10 suites / 73 tests                             |
| PostgreSQL DB tests             | PASS, 2 suites / 28 tests                              |
| HTTP/OpenAPI/concurrency E2E    | PASS, 12 suites / 85 tests                             |
| Production build                | PASS                                                   |
| OpenAPI snapshot/checksum       | PASS                                                   |
| Generated frontend API types    | PASS, snapshot current                                 |
| Restricted runtime-role smoke   | PASS, health/public/admin/docs boundaries verified     |
| Demo-web ESLint / strict TS     | PASS                                                   |
| Demo-web unit/component tests   | PASS, 5 files / 18 tests                               |
| Demo-web production build       | PASS, 250.70 kB initial JS / 32.90 kB CSS до gzip      |
| Browser integration QA          | PASS, desktop 1280 и mobile-accessible 390             |

Стабильные seed-счётчики после каждого запуска:

```text
countries=5, federations=1, disciplines=3, clubs=4,
athletes=16, horses=16, owners=5, events=3,
classes=12, results=60, rankingSnapshots=1
```

## Реализованный backend-контур

- Athletes, Horses, Competitions, Competition Classes и Results Admin API;
- strict Zod DTO, bounded pagination, allowlisted filters/sort;
- читаемые relation projections в detail/list endpoints;
- auth, opaque sessions, TOTP/recovery 2FA и persisted permissions;
- CSRF, idempotency, optimistic concurrency и PostgreSQL rate limiting;
- atomic append-only audit и restricted production runtime DB role;
- актуальный OpenAPI snapshot;
- presentation-ready batched projections: `currentClubs` и
  `primaryIdentifier` для спортсменов, `primaryIdentifier` для лошадей,
  результаты и identifiers в карточке лошади;
- generated TypeScript contract
  `api-client/generated/schema.d.ts` со stale-check в CI;
- locale-scoped published-only Public API как уже существующий, но не
  расширяемый в demo scope, модуль.

## Реализованный demo-web

- `/login` и защищённый shell без dashboard;
- обновлённая адаптивная login-страница в визуальном языке FEM с реальными
  полями email/password/TOTP и без фиктивной регистрации/social auth;
- route-level code splitting: страницы реестра и AppShell загружаются после
  входа, а не входят в initial login bundle;
- admin shell, lists, filters, tables, detail cards and drawers use the same
  performant sky/coral/Nunito visual system as `/login`;
- `/athletes`, `/athletes/:id`, `/horses`, `/horses/:id`;
- `/competitions`, `/competitions/:id` с классами и результатами внутри
  рабочего пространства;
- server-side pagination, allowlisted filters/sort и URL state;
- create/update drawers; безопасный PATCH использует CSRF и `If-Match`;
- единые loading, empty, filtered-empty, error и not-found states;
- безопасное различение 401/403/404/409/500 без raw backend messages;
- demo banner, скрытые UUID/technical fields и отсутствие fake navigation.

## Найденные и исправленные integration defects

1. `localhost` frontend и `127.0.0.1` API считались разными sites и ломали
   `SameSite=Strict` cookie. Default API и локальный preview согласованы на
   `127.0.0.1`; cookie policy не ослаблялась.
2. Nested competition routes принимают только `page/limit`; лишние sort
   параметры удалены из consumer calls вместо ослабления strict DTO.
3. Общий lookup ошибочно добавлял `status=ACTIVE` к countries и исключал
   demo DRAFT clubs/disciplines. Каждый lookup теперь использует фактический
   list contract без неподдерживаемых или чрезмерных ограничений.

## Оставшиеся demo-gaps

- RU, поля и четыре категории остаются provisional до подтверждения FEM;
- Vercel-конфигурация, same-origin API proxy, remote-seed safety и deployment
  runbook созданы, но внешний HTTPS preview ещё не развёрнут: Vercel account
  login и отдельная Neon demo-база пока не предоставлены;
- Public API, owners UI, dashboard, CMS, Excel и рейтинг остаются вне scope
  demo-web.

## Текущий gate

Статус backend DB/API baseline: **PASS**.

После Vercel preparation Graphify обновлён до 2466 узлов, 5153 связей и 179
сообществ.
Generated TypeScript contract исключён из архитектурного сканирования как
производный артефакт; исходный OpenAPI и generator остаются в карте.

### DB-first demo gates

| Этап                    | Статус      | Доказательство                                                                        |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------- |
| 0 — demo contract       | PASS        | RU и provisional поля/категории зафиксированы; 7 demo routes сопоставлены с Admin API |
| 1 — green baseline      | PASS        | Node 22.23.1, Prisma validate/generate, lint, typecheck, 10/70 unit tests, build      |
| 2 — DB/data readiness   | PASS        | clean PostgreSQL 16, 17 migrations, seed x3, 28 DB и полный E2E gate                  |
| 3 — frontend contract   | PASS        | readable projections, 85 E2E, OpenAPI и generated TypeScript contract                 |
| 4 — frontend foundation | PASS        | protected shell, API/auth client, primitives and all UI states                        |
| 5 — minimal screens     | PASS        | seven routes and full real API/demo DB scenario                                       |
| 6 — integration/QA      | PASS        | browser QA, safe mutation, 1/100 pagination, 28 DB, 85 E2E, no P0                     |
| 7 — preview             | CONDITIONAL | Vercel preparation PASS; account login, Neon and deployed smoke remain                |

Статус интегрированного локального demo: **GO**.

Статус внешнего показа: **CONDITIONAL GO** — требуется контролируемый hosting,
отдельные deployment secrets, HTTPS, точный deployed CORS origin и защищённый
или отключённый Swagger.

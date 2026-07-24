# Передача FEM demo-MVP

Дата актуализации: 2026-07-24

## Текущее состояние

Этапы 0–6 `FEM_MVP_ACCELERATED_PLAN.md` 3.0 завершены. Защищённый demo-web
работает поверх реального Admin API и отдельной локальной demo/audit DB.
Production-like локальный preview воспроизводится без Swagger, SQL, Prisma
Studio или терминала в пользовательском сценарии.

## Реализовано

- NestJS/PostgreSQL/Prisma backend и защищённый Admin API;
- auth/session/TOTP/permissions, CSRF, idempotency, optimistic concurrency,
  audit и rate limiting;
- OpenAPI snapshot и generated TypeScript consumer contract;
- React/Vite demo-web с login/protected shell;
- списки и карточки спортсменов и лошадей;
- список соревнований и единое workspace соревнования;
- категории/классы и результаты внутри соревнования;
- server-side pagination/filter/sort с URL state;
- create/update forms и безопасные frontend error states.

## Последний подтверждённый gate

- Node 22.23.1 / pnpm 11.9.0 / PostgreSQL 16;
- 17 migrations, repeatable guarded seed;
- backend: 70 unit, 28 DB, 85 E2E, lint/typecheck/build — PASS;
- OpenAPI snapshot/types — PASS;
- demo-web: 11 tests, lint/typecheck/build — PASS;
- desktop/mobile browser QA и safe mutation — PASS;
- local production preview: `http://127.0.0.1:5173`.

## Внешний preview

Статус: **CONDITIONAL**. В репозитории нет hosting project/config, а доступ к
внешней контролируемой среде, DNS/TLS и deployment secrets не предоставлен.
Это access blocker, а не основание создавать случайный публичный deployment.

Для завершения Этапа 7 используйте `docs/progress/NEXT_ACTION.md`.

## Scope guard

Не расширять Public API и не добавлять public website, dashboard, CMS,
Excel/import, ranking, owners UI либо отдельные class/result pages до
подтверждённой обратной связи по demo.

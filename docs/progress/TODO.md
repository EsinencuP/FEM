# FEM DB-first demo TODO

Updated: 2026-07-25

Источник scope: `FEM_MVP_ACCELERATED_PLAN.md` версии 3.0.

## P0 — DB/API readiness

- [x] Зафиксировать provisional язык demo: RU.
- [x] Зафиксировать provisional колонки, формы и четыре demo-категории.
- [x] Повторить baseline на Node 22 + pnpm 11.9.0.
- [x] Исправить подтверждённый unit defect.
- [x] Привести изменённый backend scope к зелёному lint/typecheck.
- [x] Проверить 17 migrations и seed x3 на чистой PostgreSQL 16.
- [x] Проверить DB/E2E: 28 DB и 85 E2E.
- [x] Создать presentation-ready repeatable seed.
- [x] Проверить runtime athlete list/detail.
- [x] Проверить runtime horse list/detail.
- [x] Проверить runtime competition list/detail.
- [x] Проверить runtime class list/detail и category/level.
- [x] Проверить runtime result list/detail.
- [x] Подтвердить filters/sort/pagination backend contract.
- [x] Добавить только недостающие frontend projections.
- [x] Обновить OpenAPI snapshot/checksum.
- [x] Добавить Public/Admin contract regression tests.
- [x] Сгенерировать и проверить consumer typed client для demo-web.

## P0 — demo frontend

- [x] Создать login/protected shell.
- [x] Добавить demo badge.
- [x] Реализовать `/athletes`.
- [x] Реализовать `/athletes/:id`.
- [x] Реализовать `/horses`.
- [x] Реализовать `/horses/:id`.
- [x] Реализовать `/competitions`.
- [x] Реализовать `/competitions/:id`.
- [x] Встроить categories/classes в competition page.
- [x] Встроить results table в competition page.
- [x] Добавить минимальные create/update forms.
- [x] Реализовать URL filters/sort/page.
- [x] Реализовать loading/empty/filtered-empty/error/404.
- [x] Выполнить integration QA.
- [x] Подготовить воспроизводимый локальный production preview.
- [x] Разместить внешний HTTPS preview на Vercel с отдельной Neon demo-базой.

## P1 — после demo

- [ ] Исправить подтверждённые замечания.
- [ ] Утвердить реальные справочники и FEM-коды.
- [ ] Утвердить первый Excel-шаблон.
- [ ] Реализовать preview/import.
- [ ] Добавить archive/restore UI.
- [ ] Добавить audit UI.
- [ ] Подготовить обучение.
- [ ] Настроить backup/restore до реальных данных.

## P2 — отдельный scope

- [x] Public API backend уже существует; публичный frontend остаётся отдельным scope.
- [ ] Dashboard/analytics.
- [ ] CMS/media.
- [ ] Ranking engine.
- [ ] Owners UI.
- [ ] Второй язык.
- [ ] Registrations/payments/live scoring.
- [ ] Integrations/webhooks.

P1/P2 не добавляются в текущий demo sprint.

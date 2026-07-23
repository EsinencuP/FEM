# Передача комплекта FEM в разработку

Дата комплекта: 2026-07-23

## Что находится в архиве

- рабочий NestJS backend foundation;
- Prisma schema и reviewed PostgreSQL migrations;
- unit, E2E и database constraint test foundation;
- локальный Docker Compose для PostgreSQL;
- CI quality gate;
- архитектурные решения;
- словарь данных, ER-диаграмма и правила БД;
- аудит и план стабилизации Database v1;
- стратегия тестирования;
- единые критерии приёмки;
- поэтапный план frontend/backend разработки.
- текущий отчёт о пройденных проверках и известных блокерах сборки.
- frontend design constitution и anti-patterns;
- DTCG design tokens, Style Dictionary и Tokens Studio themes;
- Stylelint, Playwright visual tests и Codex frontend preflight hook.

## С чего начать

1. Прочитать `README.md`.
2. Прочитать `AGENTS.md`, `docs/design-constitution.md`,
   `docs/anti-patterns.md` и `tokens/README.md`.
3. Проверить `docs/PROJECT_SPEC.md`.
4. Просмотреть `docs/OPEN_QUESTIONS.md` и закрыть блокирующие решения.
5. Использовать `docs/delivery/DEVELOPMENT_PLAN.md` как порядок реализации.
6. Создать OpenAPI skeleton до ручного описания типов во frontend.
7. Проверять готовность по `docs/delivery/ACCEPTANCE_CRITERIA.md`.
8. Подключать проверки из `docs/delivery/TESTING_STRATEGY.md` по мере появления
   модулей.
9. До интеграции frontend устранить блокеры из
   `docs/delivery/CURRENT_QUALITY_STATUS.md`.

## Границы текущей реализации

Архив не является готовой production-системой. Database v1 и backend foundation
подготовлены, но Public/Admin/Integration API, 2FA, публикационный workflow,
frontend, импорт/экспорт, production-инфраструктура и часть доменных правил ещё
должны быть реализованы.

Frontend application code пока отсутствует. Design-system foundation является
готовой основой для будущих `apps/public-web` и `apps/admin-web`, но не
подменяет выбор и создание frontend framework shell.

## Важные ограничения

- не подключать локальные тесты к production database;
- не добавлять реальные секреты в `.env.example` или репозиторий;
- не использовать `prisma migrate dev` против staging/production;
- не генерировать официальные идентификаторы автоматически;
- не публиковать рейтинг до утверждения формулы или официального источника;
- не переносить закрытые поля в Public API;
- не менять схему без отдельной reviewed migration;
- не начинать frontend с ручных типов, расходящихся с OpenAPI.

## Минимальная локальная проверка

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm frontend:check
pnpm exec playwright install chromium
pnpm frontend:quality
```

Для `test:db` используется только отдельная тестовая база, как описано в
`README.md`.

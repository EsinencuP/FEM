# FEM Backend

Технический каркас автономного REST API для информационной платформы Национальной федерации конного спорта Молдовы. Репозиторий содержит только backend-инфраструктуру первого этапа: предметные модели, frontend и production-интеграции намеренно отсутствуют.

## Требования

- Node.js 22 LTS;
- pnpm 11;
- Docker Desktop с Docker Compose;
- Git.

Рекомендуется установить Node.js через менеджер версий и выполнить `nvm use` (в `.nvmrc` зафиксирован Node 22). pnpm можно включить через Corepack:

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
```

## Быстрый старт

1. Установите зависимости:

   ```bash
   pnpm install
   ```

2. Создайте локальную конфигурацию:

   ```bash
   cp .env.example .env
   ```

   В PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   Замените `change_me_local_only` в обеих связанных переменных. Значения `POSTGRES_PASSWORD` и пароль внутри `DATABASE_URL` должны совпадать.

3. Запустите PostgreSQL 16:

   ```bash
   pnpm db:up
   ```

4. Проверьте и сгенерируйте Prisma Client:

   ```bash
   pnpm prisma:validate
   pnpm prisma:generate
   ```

5. Запустите backend:

   ```bash
   pnpm start:dev
   ```

API будет доступен по адресу `http://localhost:3000/api`, health endpoint — `http://localhost:3000/api/health`, Swagger UI — `http://localhost:3000/api/docs`, OpenAPI JSON — `http://localhost:3000/api/docs-json`.

## Миграции

На первом этапе предметных моделей нет, поэтому начальная миграция намеренно не создана. После согласования схемы следующего этапа:

```bash
pnpm prisma:migrate:dev --name <migration_name>
```

Для применения уже закоммиченных миграций в контролируемой среде:

```bash
pnpm prisma:migrate:deploy
```

Не запускайте `migrate dev`, reset или destructive SQL против staging/production. Production-доступы не должны храниться в репозитории.

## Команды

| Команда                      | Назначение                                             |
| ---------------------------- | ------------------------------------------------------ |
| `pnpm start:dev`             | Запуск NestJS в watch-режиме                           |
| `pnpm build`                 | Production-сборка в `dist/`                            |
| `pnpm start:prod`            | Запуск собранного приложения                           |
| `pnpm lint`                  | Строгая ESLint-проверка                                |
| `pnpm lint:fix`              | Безопасные автоматические ESLint-исправления           |
| `pnpm format`                | Форматирование исходников и документации               |
| `pnpm typecheck`             | TypeScript-проверка без генерации файлов               |
| `pnpm test`                  | Unit-тесты                                             |
| `pnpm test:e2e`              | E2E-тест с реальным локальным PostgreSQL               |
| `pnpm prisma:generate`       | Генерация Prisma Client                                |
| `pnpm prisma:validate`       | Проверка Prisma schema                                 |
| `pnpm prisma:format`         | Форматирование Prisma schema                           |
| `pnpm prisma:migrate:dev`    | Создание/применение dev-миграций                       |
| `pnpm prisma:migrate:deploy` | Применение готовых миграций                            |
| `pnpm prisma:studio`         | Локальный Prisma Studio                                |
| `pnpm db:up`                 | Запуск локального PostgreSQL с ожиданием healthcheck   |
| `pnpm db:down`               | Остановка локального Compose-стека без удаления volume |
| `pnpm db:logs`               | Поток логов PostgreSQL                                 |

Команда `db:reset` намеренно отсутствует: на этом этапе нет миграций, а случайный reset несёт неоправданный риск потери данных.

## Тестирование и quality gate

Полная локальная проверка без HTTP smoke-теста:

```bash
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Для E2E сначала выполните `pnpm db:up`, затем `pnpm test:e2e`. GitHub Actions на push и pull request выполняет установку с frozen lockfile, Prisma validate/generate, lint, typecheck, unit tests и build. Workflow использует фиктивный `DATABASE_URL` только для генерации клиента и не подключается к production-базе.

## Структура

```text
src/
  common/pipes/       общий Zod validation pipe для будущих входных DTO
  config/             единая Zod-валидация env и типизированный доступ к config
  database/           глобальный DatabaseModule и singleton PrismaService
  health/             health endpoint с реальным SELECT 1
prisma/               Prisma schema без предметных моделей
test/                 E2E smoke-тест
docs/                 спецификация, правила БД, вопросы и ADR
.github/workflows/    CI quality gate
docker-compose.yml    только локальный PostgreSQL 16
```

## Логирование

Pino пишет структурированные JSON-логи в production и читаемый pretty-формат локально. Каждый HTTP-запрос получает `x-request-id`; completion log содержит HTTP status и длительность. Authorization, cookies, пароли и токены редактируются до записи в лог.

## Правила безопасности

- `.env` и все его варианты исключены из Git; коммитить можно только `.env.example` без реальных секретов.
- Не используйте локальные credentials в staging/production.
- Не логируйте `DATABASE_URL`, пароли, токены, cookie и Authorization headers.
- Не включайте CORS глобально до согласования точных frontend origins.
- Не подключайте production-базу к локальным тестам или CI.
- Любое изменение Prisma schema проходит review и оформляется отдельной миграцией.
- Supabase может использоваться только как managed PostgreSQL hosting; Supabase SDK не является частью бизнес-логики.

## Остановка локальной базы

```bash
pnpm db:down
```

Команда сохраняет named volume `fem-postgres-data`. Удаление volume выполняется только вручную и только при осознанной очистке локальных данных.

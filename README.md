# FEM Backend

Автономный backend информационной платформы Национальной федерации конного
спорта Молдовы. Репозиторий содержит NestJS REST API, PostgreSQL/Prisma-модель,
защищённую административную поверхность, внутренний demo-web и versioned
ranking snapshots без официальной формулы. Регистрация на турниры, публичный
frontend и полный production-релиз намеренно отсутствуют. Защищённый внешний
customer-demo подготовлен к размещению на Vercel с отдельной managed PostgreSQL.

> Административные маршруты `/api/v1/admin/*` защищены server-side session,
> TOTP/recovery 2FA, permission checks, CSRF и shared rate limiting. Активный
> delivery scope определён `FEM_MVP_ACCELERATED_PLAN.md`: первый consumer —
> защищённый DB-first demo-web через Admin API. Уже реализованный
> published-only sports Public API сохраняется под `/api/v1/public/{lang}`, но
> не расширяется и не является условием первого demo. Backend нельзя открывать
> в Интернет как готовый публичный релиз.

Порядок чтения:

- `FEM_MVP_ACCELERATED_PLAN.md`;
- `docs/README.md`;
- `docs/progress/NEXT_ACTION.md`;
- `docs/delivery/CURRENT_QUALITY_STATUS.md`.
- `docs/deployment/VERCEL_DEMO_DEPLOYMENT.md` — внешний customer-demo.

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

   Замените `change_me_local_only` в обеих связанных переменных. Значения
   `POSTGRES_PASSWORD` и пароль внутри `DATABASE_URL` должны совпадать.
   `CORS_ALLOWED_ORIGINS` — разделённый запятыми список точных frontend origins
   без путей и wildcard. Production не запускается с пустым списком.
   `AUTH_ENCRYPTION_KEY` должен быть случайным 32-байтовым ключом в hex
   (64 символа). Не используйте значение из `.env.example`.

3. Запустите PostgreSQL 16:

   ```bash
   pnpm db:up
   ```

4. Примените локальную миграцию и безопасный demo seed:

   ```bash
   pnpm prisma:validate
   pnpm prisma:generate
   pnpm prisma:migrate:dev
   ALLOW_DEMO_SEED=true pnpm prisma:seed
   ```

   В PowerShell demo seed требует явного opt-in только для текущего процесса:

   ```powershell
   $env:ALLOW_DEMO_SEED = 'true'
   pnpm prisma:seed
   Remove-Item Env:ALLOW_DEMO_SEED
   ```

   Seed отклоняет production, удалённые PostgreSQL hosts, неизвестные имена БД
   и коллизии demo natural key с non-demo записями до первого изменения.

5. Запустите backend:

   ```bash
   pnpm start:dev
   ```

6. Запустите внутренний demo-web во втором терминале:

   ```bash
   pnpm web:dev
   ```

   Для проверки production-сборки:

   ```bash
   pnpm web:build
   pnpm web:preview
   ```

Backend и frontend должны использовать одно и то же имя host. Значение по
умолчанию demo-web — `http://127.0.0.1:3000/api/v1`; поэтому локальный CORS
должен содержать точный origin `http://127.0.0.1:5173`. Не смешивайте
`localhost` и `127.0.0.1`: при `SameSite=Strict` это разные sites.

Demo-web доступен по адресу `http://127.0.0.1:5173`, API —
`http://127.0.0.1:3000/api`, health endpoint —
`http://127.0.0.1:3000/api/health`. Swagger UI —
`http://127.0.0.1:3000/api/docs`, OpenAPI JSON —
`http://127.0.0.1:3000/api/docs-json`. Swagger не является частью сценария
показа заказчику.

## Внешний customer-demo на Vercel

Репозиторий подготовлен как два Vercel Project из одного monorepo:

- NestJS API из корня репозитория;
- Vite demo-web из `apps/demo-web`.

Frontend обращается к API через same-origin `/api/v1` proxy, поэтому защищённая
cookie сохраняет `HttpOnly`, `Secure` и `SameSite=Strict`. Для базы используется
отдельный Neon PostgreSQL из Vercel Marketplace; локальный Docker Compose в
Vercel не запускается.

Полная последовательность создания базы, миграций, двойного seed, постоянной
demo-учётной записи, restricted runtime role, Vercel variables и smoke-test:
[`docs/deployment/VERCEL_DEMO_DEPLOYMENT.md`](docs/deployment/VERCEL_DEMO_DEPLOYMENT.md).
Секреты demo-размещения находятся только в локальном ignored
`.env.vercel.local` и должны быть перенесены в Vercel Secret Manager.

## Первый администратор

Bootstrap выполняется один раз и не перезаписывает существующие credentials.
Задайте process-local `INITIAL_ADMIN_*`, установите
`ALLOW_ADMIN_BOOTSTRAP=true`, затем:

```powershell
pnpm admin:bootstrap
Remove-Item Env:ALLOW_ADMIN_BOOTSTRAP
Remove-Item Env:INITIAL_ADMIN_PASSWORD
Remove-Item Env:INITIAL_ADMIN_TOTP_SECRET
```

Сохраните показанные recovery-коды вне репозитория. Сам bootstrap создаёт роль
`ADMIN`, пять системных permission (`ADMIN_READ`, `ADMIN_WRITE`,
`AUDIT_READ`, `SECURITY_SELF`, `VERSION_OVERRIDE`), Argon2id credential, TOTP
и immutable audit event. Подробный протокол:
`docs/delivery/ADMIN_API_SECURITY.md`.

## Миграции

Текущий baseline состоит из семнадцати последовательных reviewed migrations.
Первые две фиксируют доменную базу, следующие одиннадцать — Admin security и
runtime-role hardening, последние четыре — Public visibility/search/profile
publication integrity:

- `20260722201238_initial_database_v1` — исходная схема Database v1;
- `20260722204033_mvp_database_stabilization` — безопасная корректировка approval FK и четыре индекса для каталогов/календаря.
- `20260723234136_admin_security` и `20260723235000_admin_security_constraints`;
- `20260724093000_admin_session_hardening`;
- `20260724094500_session_rotation_grace`;
- `20260724100000_postgres_rate_limit`;
- `20260724101500_admin_idempotency`;
- `20260724103000_optimistic_versions`;
- `20260724104500_admin_permissions`;
- `20260724110000_version_override_permission`;
- `20260724111000_runtime_database_role`;
- `20260724112000_runtime_role_hardening`;
- `20260724113000_public_visibility_and_search_hardening`;
- `20260724113100_result_metric_trigger_privileges`;
- `20260724113200_public_function_execution_hardening`;
- `20260724114000_profile_publication_workflow`.

Для локального применения:

```bash
pnpm prisma:migrate:dev
ALLOW_DEMO_SEED=true pnpm prisma:seed
```

Для применения уже закоммиченных миграций в контролируемой среде:

```bash
pnpm prisma:migrate:deploy
```

Не запускайте `migrate dev`, reset или destructive SQL против staging/production. Production-доступы не должны храниться в репозитории.

## Команды

| Команда                            | Назначение                                             |
| ---------------------------------- | ------------------------------------------------------ |
| `pnpm start:dev`                   | Запуск NestJS в watch-режиме                           |
| `pnpm build`                       | Production-сборка в `dist/`                            |
| `pnpm start:prod`                  | Запуск собранного приложения                           |
| `pnpm lint`                        | Строгая ESLint-проверка                                |
| `pnpm lint:fix`                    | Безопасные автоматические ESLint-исправления           |
| `pnpm format`                      | Форматирование исходников и документации               |
| `pnpm typecheck`                   | TypeScript-проверка без генерации файлов               |
| `pnpm test`                        | Unit-тесты                                             |
| `pnpm test:e2e`                    | E2E-тест с реальным локальным PostgreSQL               |
| `pnpm test:db`                     | PostgreSQL constraint tests на выделенной test-базе    |
| `pnpm test:performance`            | Локальный opt-in smoke на 10 000 результатов           |
| `pnpm test:runtime-role`           | Build + production smoke под restricted DB login       |
| `pnpm openapi:export`              | Обновление versioned OpenAPI snapshot для frontend     |
| `pnpm openapi:check`               | Проверка актуальности OpenAPI snapshot/checksum        |
| `pnpm openapi:types`               | Генерация TypeScript API contract из OpenAPI           |
| `pnpm openapi:types:check`         | Проверка актуальности generated TypeScript contract    |
| `pnpm prisma:generate`             | Генерация Prisma Client                                |
| `pnpm prisma:validate`             | Проверка Prisma schema                                 |
| `pnpm prisma:format`               | Форматирование Prisma schema                           |
| `pnpm prisma:migrate:dev`          | Создание/применение dev-миграций                       |
| `pnpm prisma:migrate:deploy`       | Применение готовых миграций                            |
| `pnpm prisma:seed`                 | Demo seed; требует явного `ALLOW_DEMO_SEED=true`       |
| `pnpm demo:database-confirmation`  | Точный opt-in token для remote demo seed               |
| `pnpm demo:provision-runtime-role` | Restricted PostgreSQL login для внешнего demo          |
| `pnpm prisma:studio`               | Локальный Prisma Studio                                |
| `pnpm db:up`                       | Запуск локального PostgreSQL с ожиданием healthcheck   |
| `pnpm db:down`                     | Остановка локального Compose-стека без удаления volume |
| `pnpm db:logs`                     | Поток логов PostgreSQL                                 |
| `pnpm web:dev`                     | Demo-web в Vite dev-режиме на `127.0.0.1:5173`         |
| `pnpm web:preview`                 | Локальный preview production-сборки demo-web           |
| `pnpm web:format`                  | Prettier для demo-web                                  |
| `pnpm web:lint`                    | ESLint для demo-web                                    |
| `pnpm web:typecheck`               | Strict TypeScript для demo-web                         |
| `pnpm web:test`                    | Unit/component tests demo-web                          |
| `pnpm web:build`                   | Production-сборка demo-web                             |
| `pnpm vercel:build`                | Локальный эквивалент backend build command Vercel      |

Команда `db:reset` намеренно отсутствует: случайный reset persistent local database несёт неоправданный риск потери данных.

Production database-role provisioning отличается от локальной настройки
`.env`. Перед использованием runtime credential выполните процедуру role
membership, cross-database `CONNECT` isolation и SQL preflight из
[`docs/delivery/ADMIN_API_SECURITY.md`](docs/delivery/ADMIN_API_SECURITY.md).

## Тестирование и quality gate

DB integration и E2E являются mutating suites. Они откажутся запускаться на
development/remote database. Создайте отдельную локальную базу и задайте
process-local URL с теми же local credentials, что в `.env`:

```powershell
docker exec fem-postgres-local psql -U app -d postgres -c "CREATE DATABASE equestrian_federation_test;"
$env:NODE_ENV = 'test'
$env:ALLOW_DEMO_SEED = 'true'
$env:DATABASE_URL = '<локальный URL из .env с именем equestrian_federation_test>'
pnpm prisma:migrate:deploy
pnpm prisma:seed
pnpm test:db
pnpm test:e2e
```

После подготовки test/audit database полный PowerShell quality gate:

```powershell
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm openapi:check
pnpm openapi:types:check
pnpm build
pnpm web:lint
pnpm web:typecheck
pnpm web:test
pnpm web:build
```

Не запускайте mutating suites из IDE с произвольной Jest-конфигурацией:
официальные configs и сами suites выполняют одинаковую safety-проверку.

Generic POST/PATCH для соревнований и результатов намеренно не принимает
`publicationStatus`. Отдельные Admin `publish`/`withdraw` commands защищены
session, CSRF, optimistic version, explicit confirmation/reason и atomic audit.
Полный Public API contract описан в
[`docs/delivery/PUBLIC_API.md`](docs/delivery/PUBLIC_API.md).

GitHub Actions использует ephemeral PostgreSQL 16 с непроизводственными credentials и выполняет migration, seed, constraint и HTTP E2E tests после обычных validate/generate/lint/typecheck/unit gates.

## Структура

```text
src/
  bootstrap/          единая HTTP/Swagger-конфигурация
  common/database/    safety, archive/reference policy и Serializable retry
  common/security/    token crypto и PostgreSQL-backed rate-limit storage
  common/pipes/       общий Zod validation pipe
  config/             единая Zod-валидация env и типизированный доступ к config
  database/           глобальный DatabaseModule и singleton PrismaService
  health/             health endpoint с реальным SELECT 1
  modules/auth/       session, 2FA, permissions, CSRF и lifecycle
  modules/audit/      read-only immutable administrative audit
  modules/public-api/ published-only locale-scoped read projections
  modules/            доменные Admin controllers/services/strict DTO
apps/demo-web/        защищённый React/Vite consumer Admin API
prisma/               schema, reviewed migrations и idempotent demo seed
test/                 HTTP/OpenAPI/concurrency E2E и PostgreSQL constraint tests
docs/database/        предложения, audit, baseline, delete/index policy и migration safety
docs/stabilization/   четыре цикла аудита, defect/fix registers и final report
docs/                 data dictionary, ER diagram, спецификация, правила, вопросы и ADR
.github/workflows/    CI quality gate
docker-compose.yml    только локальный PostgreSQL 16
```

## Логирование

Pino пишет структурированные JSON-логи в production и читаемый pretty-формат локально. Каждый HTTP-запрос получает `x-request-id`; completion log содержит HTTP status и длительность. Authorization, cookies, пароли и токены редактируются до записи в лог.

## Правила безопасности

- `.env` и все его варианты исключены из Git; коммитить можно только `.env.example` без реальных секретов.
- Не открывайте backend публично до завершения CMS и production release gates;
  Admin API и sports Public API уже изолированы, но это не заменяет оставшиеся
  этапы релиза.
- Admin cookie — `HttpOnly`, `SameSite=Strict`, `Secure` в production. Все
  state-changing Admin-запросы требуют CSRF; POST также требует
  `Idempotency-Key`, PATCH — числовой `If-Match`.
- Archive/restore, publish/withdraw, DELETE и `If-Match:*` требуют
  `X-Confirm-Action: true` и `X-Action-Reason`.
- Production Swagger либо выключается, либо защищается отдельными Basic
  credentials длиной не менее 16 символов.
- Не используйте локальные credentials в staging/production.
- Не логируйте `DATABASE_URL`, пароли, токены, cookie и Authorization headers.
- Не включайте CORS глобально до согласования точных frontend origins.
- Не подключайте production-базу к локальным тестам или CI.
- Любое изменение Prisma schema проходит review и оформляется отдельной миграцией.
- Официальные ID не генерируются и не используются как primary key; FEI/passport/microchip хранятся только как external identifiers из источника.
- Demo seed содержит только явно вымышленные данные и один неопубликованный `DEMO` ranking snapshot.
- `prisma migrate dev`, Studio и test cleanup разрешены только для явно проверенной локальной базы.
- Approval evidence (`approvedAt` + `approvedById`) защищено `RESTRICT`: сначала выполняется отдельная аудируемая отмена approval, а не удаление actor.
- Supabase может использоваться только как managed PostgreSQL hosting; Supabase SDK не является частью бизнес-логики.

## Остановка локальной базы

```bash
pnpm db:down
```

Команда сохраняет named volume `fem-postgres-data`. Удаление volume выполняется только вручную и только при осознанной очистке локальных данных.

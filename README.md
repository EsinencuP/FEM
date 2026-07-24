# FEM Backend

Автономный backend информационной платформы Национальной федерации конного
спорта Молдовы. Репозиторий содержит NestJS REST API, PostgreSQL/Prisma-модель,
защищённую административную поверхность и versioned ranking snapshots без
официальной формулы. Frontend, регистрация на турниры и production deployment
намеренно отсутствуют.

> Административные маршруты `/api/v1/admin/*` защищены server-side session,
> TOTP/recovery 2FA, permission checks, CSRF и shared rate limiting. Полный
> published-only Public API и CMS ещё не завершены, поэтому backend пока нельзя
> открывать в Интернет как готовый публичный релиз.

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

API будет доступен по адресу `http://localhost:3000/api`, health endpoint — `http://localhost:3000/api/health`, Swagger UI — `http://localhost:3000/api/docs`, OpenAPI JSON — `http://localhost:3000/api/docs-json`.

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
`ADMIN`, четыре системных permission (`ADMIN_READ`, `ADMIN_WRITE`,
`AUDIT_READ`, `SECURITY_SELF`), Argon2id credential, TOTP и immutable audit
event. Подробный протокол: `docs/delivery/ADMIN_API_SECURITY.md`.

## Миграции

Database v1 и Stage 2 security baseline состоят из десяти последовательных
reviewed migrations. Первые две фиксируют доменную базу; последующие восемь
добавляют только security/integrity-инфраструктуру:

- `20260722201238_initial_database_v1` — исходная схема Database v1;
- `20260722204033_mvp_database_stabilization` — безопасная корректировка approval FK и четыре индекса для каталогов/календаря.
- `20260723234136_admin_security` и `20260723235000_admin_security_constraints`;
- `20260724093000_admin_session_hardening`;
- `20260724094500_session_rotation_grace`;
- `20260724100000_postgres_rate_limit`;
- `20260724101500_admin_idempotency`;
- `20260724103000_optimistic_versions`;
- `20260724104500_admin_permissions`.

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
| `pnpm test:db`               | PostgreSQL constraint tests на выделенной test-базе    |
| `pnpm test:performance`      | Локальный opt-in smoke на 10 000 результатов           |
| `pnpm openapi:export`        | Обновление versioned OpenAPI snapshot для frontend     |
| `pnpm prisma:generate`       | Генерация Prisma Client                                |
| `pnpm prisma:validate`       | Проверка Prisma schema                                 |
| `pnpm prisma:format`         | Форматирование Prisma schema                           |
| `pnpm prisma:migrate:dev`    | Создание/применение dev-миграций                       |
| `pnpm prisma:migrate:deploy` | Применение готовых миграций                            |
| `pnpm prisma:seed`           | Demo seed; требует явного `ALLOW_DEMO_SEED=true`       |
| `pnpm prisma:studio`         | Локальный Prisma Studio                                |
| `pnpm db:up`                 | Запуск локального PostgreSQL с ожиданием healthcheck   |
| `pnpm db:down`               | Остановка локального Compose-стека без удаления volume |
| `pnpm db:logs`               | Поток логов PostgreSQL                                 |

Команда `db:reset` намеренно отсутствует: случайный reset persistent local database несёт неоправданный риск потери данных.

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
pnpm build
```

Не запускайте mutating suites из IDE с произвольной Jest-конфигурацией:
официальные configs и сами suites выполняют одинаковую safety-проверку.

Generic POST/PATCH для соревнований и результатов намеренно не принимает
`publicationStatus`: публикация будет отдельным permission-protected и
audit-atomic workflow на этапе Public API/CMS.

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
  modules/            доменные Admin controllers/services/strict DTO
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
- Не открывайте backend публично до завершения published-only Public API, CMS и
  production release gates; Admin API уже защищён, но это не заменяет оставшиеся
  этапы релиза.
- Admin cookie — `HttpOnly`, `SameSite=Strict`, `Secure` в production. Все
  state-changing Admin-запросы требуют CSRF; POST также требует
  `Idempotency-Key`, PATCH — числовой `If-Match`.
- Archive/restore, DELETE и `If-Match:*` требуют `X-Confirm-Action: true` и
  `X-Action-Reason`.
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

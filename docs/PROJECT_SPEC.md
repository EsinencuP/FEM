# Project Specification: Backend Foundation and Database v1

## Назначение инфраструктурного этапа

Создать безопасную автономную основу backend-приложения, которую будущий frontend сможет использовать через REST/OpenAPI. Этап не определяет предметные сущности Федерации и не фиксирует бизнес-правила.

## Входит в объём

- NestJS-приложение на Node.js 22 LTS и pnpm;
- TypeScript strict mode без `any`, `ts-ignore` и отключения strict-проверок;
- PostgreSQL 16 локально через Docker Compose;
- Prisma Client с одним управляемым NestJS-экземпляром;
- обязательная Zod-валидация конфигурации при старте;
- общий Zod validation pipe для будущих входных DTO;
- Pino HTTP/application logging с request id и redaction;
- Swagger UI и OpenAPI JSON;
- health endpoint с реальным запросом к PostgreSQL;
- unit/E2E test foundations;
- lint, format, typecheck, build и CI quality gate;
- эксплуатационная документация и ADR.

## Database v1: утверждённый объём

Второй этап добавляет первую рабочую реляционную модель без реализации предметных REST endpoints. В объём входят:

- системные таблицы пользователей, ролей, аудита, импорта, документов, медиа и внешних идентификаторов;
- справочники стран, национальных федераций, дисциплин, клубов и статусов результатов;
- спортсмены, лошади, владельцы и исторические связи между ними;
- информационные турниры, классы и опубликованные после проведения результаты;
- расширяемое хранение ranking definitions, periods, snapshots, entries и source results без официальной формулы;
- первая локальная Prisma migration, безопасный повторяемый demo seed и database constraint tests;
- data dictionary, ER diagram, index/unique strategy и migration safety documentation.

Все основные записи используют внутренний UUID. Официальные и внешние идентификаторы не являются primary key и не генерируются системой. Неподтверждённые поля nullable или конфигурируемы и помечаются как provisional в документации.

## Не входит в объём

- frontend, UI и привязка к frontend-фреймворку;
- предметные REST endpoints, авторизация, административные операции и permission enforcement;
- регистрация на турниры, заявки, платежи, стартовые листы, жеребьёвка и live scoring;
- официальная формула рейтинга, коэффициенты, таблицы очков и официальные коды дисциплинарных показателей;
- production database, production deployment и production secrets;
- Supabase SDK, MongoDB или SQLite;
- неподтверждённые бизнес-правила и процессы Федерации.

## Runtime-контракт

- HTTP prefix: значение `API_PREFIX`, локально `api`;
- health: `GET /api/health`;
- Swagger UI: `/api/docs`;
- OpenAPI JSON: `/api/docs-json`;
- приложение не стартует без валидных `NODE_ENV`, `PORT`, `DATABASE_URL`, `LOG_LEVEL`, `API_PREFIX`;
- приложение подключается к PostgreSQL при инициализации модуля и закрывает соединение при graceful shutdown.

## Критерии готовности инфраструктурного этапа

1. Prisma schema не содержит предметных моделей.
2. `.env` игнорируется Git, `.env.example` не содержит настоящих секретов.
3. Все quality-команды завершаются успешно.
4. PostgreSQL container проходит healthcheck.
5. Health endpoint подтверждает реальное соединение с PostgreSQL.
6. Swagger UI и OpenAPI JSON доступны локально.
7. CI не использует production database.

## Критерии готовности Database v1

1. PostgreSQL 16 запускается локально, migration применяется к чистой локальной базе.
2. Prisma schema использует UUID primary keys и не генерирует официальные идентификаторы.
3. Турнирная модель ограничена `CompetitionEvent -> CompetitionClass -> CompetitionResult`; registration entities отсутствуют.
4. История клубов, всадников и владельцев хранится в temporal relation tables.
5. Ranking snapshots историчны и versioned, но calculation formula не реализована.
6. Seed содержит только очевидно вымышленные demo data и безопасно запускается повторно.
7. Constraint/integration tests, lint, strict typecheck и build проходят.
8. Документация соответствует фактической schema и перечисляет provisional решения.

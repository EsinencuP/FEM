# Project Specification: Backend Foundation

## Назначение этапа

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

## Не входит в объём

- frontend, UI и привязка к frontend-фреймворку;
- спортсмены, лошади, соревнования, рейтинги и любые другие предметные модели;
- авторизация, роли и администрирование;
- production database, production deployment и production secrets;
- Supabase SDK, MongoDB или SQLite;
- бизнес-правила и процессы Федерации.

## Runtime-контракт

- HTTP prefix: значение `API_PREFIX`, локально `api`;
- health: `GET /api/health`;
- Swagger UI: `/api/docs`;
- OpenAPI JSON: `/api/docs-json`;
- приложение не стартует без валидных `NODE_ENV`, `PORT`, `DATABASE_URL`, `LOG_LEVEL`, `API_PREFIX`;
- приложение подключается к PostgreSQL при инициализации модуля и закрывает соединение при graceful shutdown.

## Критерии готовности

1. Prisma schema не содержит предметных моделей.
2. `.env` игнорируется Git, `.env.example` не содержит настоящих секретов.
3. Все quality-команды завершаются успешно.
4. PostgreSQL container проходит healthcheck.
5. Health endpoint подтверждает реальное соединение с PostgreSQL.
6. Swagger UI и OpenAPI JSON доступны локально.
7. CI не использует production database.

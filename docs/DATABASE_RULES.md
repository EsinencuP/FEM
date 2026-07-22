# Database Rules

## Базовые ограничения

1. Основная СУБД — PostgreSQL. MongoDB и SQLite не используются.
2. `DATABASE_URL` поступает только из environment configuration и никогда не коммитится с реальными credentials.
3. Локальная разработка использует PostgreSQL 16 из `docker-compose.yml` и отдельный persistent named volume.
4. Production credentials запрещено использовать локально или в CI.
5. `PrismaClient` создаётся только через глобальный `PrismaService`; сервисы не создают собственные экземпляры.

## Prisma schema и миграции

- На первом этапе schema содержит только `generator client` и `datasource db`.
- Предметные модели добавляются только после отдельного согласования.
- Каждое изменение schema сопровождается именованной migration и review сгенерированного SQL.
- `prisma migrate dev` разрешён только для локальной development database.
- `prisma migrate deploy` применяется в controlled deployment к заранее проверенным миграциям.
- `prisma db push`, reset и ручное destructive SQL не являются штатным production-процессом.
- Миграции после общего использования не переписываются; исправление выполняется новой миграцией.

## Данные и безопасность

- В `.env.example` используются только placeholders.
- Database URL, пароли и connection strings должны редактироваться в логах и diagnostic output.
- Для staging/production нужны отдельные пользователи БД с минимальными правами.
- Migration role и runtime role рекомендуется разделить.
- Перед production необходимо определить backup, restore test, retention, encryption и incident procedure.

## Managed PostgreSQL

Supabase PostgreSQL может быть выбран как managed hosting для staging/production. В этом случае приложение продолжает использовать стандартный PostgreSQL connection string через Prisma. Supabase SDK не добавляется в business layer без отдельного архитектурного решения.

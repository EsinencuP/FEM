# ADR-003: Local Docker and Managed Production Database

- Status: Accepted
- Date: 2026-07-22

## Context

Разработчикам нужна воспроизводимая локальная PostgreSQL-среда без доступа к production. Production database требует backups, monitoring, updates и controlled secrets, которые не следует имитировать локальным container deployment.

## Decision

Использовать Docker Compose и PostgreSQL 16 только для local development. Для staging/production выбрать managed PostgreSQL после операционной оценки; Supabase PostgreSQL рассматривается как один из вариантов hosting.

## Rationale

- Docker Compose фиксирует major version, healthcheck, port mapping и persistent volume.
- Локальные credentials отделены от repository и production secrets.
- Managed provider снижает операционную нагрузку на backups, availability, patching и monitoring.
- Стандартный `DATABASE_URL` позволяет сменить provider без изменения business logic.

## Consequences

- Docker Compose файл не является production deployment manifest.
- CI использует только фиктивный URL для Prisma validation/generation и unit tests, без production database.
- Staging integration tests потребуют отдельной ephemeral/test database и отдельного решения.
- До production необходимо утвердить provider, region, pooling, backups, recovery, encryption и secret rotation.

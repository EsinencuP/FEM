# ADR-002: PostgreSQL and Prisma

- Status: Accepted
- Date: 2026-07-22

## Context

Будущая информационная платформа ожидает структурированные взаимосвязанные данные, транзакции и надёжные миграции. На текущем этапе модель данных ещё не согласована.

## Decision

Использовать PostgreSQL 16 и Prisma ORM. Зафиксировать Prisma 6.19.3 как последнюю совместимую ветку, сохраняющую требуемую schema-based конфигурацию `DATABASE_URL` и стандартный `PrismaClient` без дополнительных driver adapters. На первом этапе не создавать модели и миграции.

## Rationale

- PostgreSQL предоставляет транзакции, constraints, индексы и зрелую эксплуатационную экосистему.
- Prisma обеспечивает типизированный client, declarative schema и reviewable SQL migrations.
- Prisma получает стандартный PostgreSQL URL из environment, поэтому hosting provider не связан с business layer.
- Один `PrismaService` управляется NestJS lifecycle, предотвращая uncontrolled connection pools.

## Consequences

- Переход на Prisma 7 оценивается отдельным dependency/architecture upgrade из-за изменения client generation и driver adapter requirements.
- Все изменения schema проходят review и оформляются миграциями.
- Supabase при выборе используется как PostgreSQL hosting, а не как SDK dependency business logic.
- Предметные сущности будут спроектированы только в следующем утверждённом этапе.

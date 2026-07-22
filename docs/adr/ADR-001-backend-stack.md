# ADR-001: NestJS, REST and OpenAPI

- Status: Accepted
- Date: 2026-07-22

## Context

Платформе нужен автономный backend, не зависящий от реализации будущего frontend. На первом этапе важны понятная модульность, строгая типизация, документированный HTTP contract и предсказуемый процесс тестирования.

## Decision

Использовать Node.js 22 LTS, NestJS, TypeScript strict mode, REST и OpenAPI/Swagger.

## Rationale

- NestJS задаёт явные границы модулей, dependency injection и lifecycle hooks, полезные для управляемого database connection и дальнейшего роста.
- TypeScript strict mode снижает количество скрытых runtime-ошибок и запрещает маскировать проблемы через `any`.
- REST сохраняет независимость frontend и поддерживается большинством клиентов и инфраструктурных инструментов.
- OpenAPI создаёт машиночитаемый contract, Swagger UI — доступную разработчикам документацию.

## Consequences

- Новые функции оформляются как NestJS modules с контролируемыми dependencies.
- API contract должен обновляться вместе с endpoint changes.
- CORS, auth и versioning требуют отдельных решений до публичного production API.
- Решение не определяет предметную модель Федерации.

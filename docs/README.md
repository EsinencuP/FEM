# Навигация по документации FEM

Дата актуализации: 2026-07-24

Текущая цель — DB-first demo-MVP внутреннего инструмента учёта. Публичный сайт
и расширение уже существующего Public API не входят в первый показ; demo-web
использует только защищённый Admin API.

## Читать перед разработкой

1. `../AGENTS.md` — правила репозитория.
2. `../FEM_MVP_ACCELERATED_PLAN.md` — единственный источник scope.
3. `progress/NEXT_ACTION.md` — ближайшее действие.
4. `progress/TODO.md` — текущий backlog.
5. `delivery/CURRENT_QUALITY_STATUS.md` — проверенный baseline.
6. `delivery/FRONTEND_API_MATRIX.md` — контракт demo-web с Admin API.
7. `MVP_LIMITATIONS.md` — честные ограничения.
8. `OPEN_QUESTIONS.md` — только решения владельца проекта.

Для frontend дополнительно:

- `design-constitution.md`;
- `anti-patterns.md`.

Для изменений backend/БД дополнительно:

- `DATABASE_RULES.md`;
- `DATA_DICTIONARY.md`;
- `ENTITY_MATRIX.md`;
- `ER_DIAGRAM.md`;
- `delivery/ADMIN_API_SECURITY.md`;
- `database/MVP_DATABASE_BASELINE.md`;
- `database/MIGRATION_SAFETY.md`.

## Активные delivery-документы

| Файл                                 | Назначение                                |
| ------------------------------------ | ----------------------------------------- |
| `delivery/DEVELOPMENT_PLAN.md`       | краткая DB-first дорожная карта           |
| `delivery/ACCEPTANCE_CRITERIA.md`    | gate БД/API и demo UI                     |
| `delivery/BACKEND_SCOPE_MATRIX.md`   | что переиспользуется и что нужно доделать |
| `delivery/FRONTEND_API_MATRIX.md`    | фильтры, сортировка и routes              |
| `delivery/CURRENT_QUALITY_STATUS.md` | факты последней проверки                  |
| `delivery/HANDOFF.md`                | передача следующему агенту                |

## Исторические и справочные материалы

Не являются текущим backlog:

- `stabilization/**`;
- `stabilization/cycles/**`;
- `database/00-*.md` … `database/05-*.md`;
- `database/*AUDIT*.md`;
- `progress/CHANGELOG_AI.md`;
- `PROJECT_SPEC.md`;
- `GRAPHIFY_INSTALLATION_REPORT.md`;
- `GRAPHIFY_WORKFLOW.md`.

Старые планы публичного MVP также считаются заменёнными версией 3.0 основного
плана.

## Приоритет при конфликте

1. Текущий код и миграции.
2. `FEM_MVP_ACCELERATED_PLAN.md`.
3. `delivery/CURRENT_QUALITY_STATUS.md`.
4. Остальные активные документы.
5. Исторические отчёты.

Если код расходится с документацией, сначала выполняется проверка. Scope при
этом не расширяется автоматически.

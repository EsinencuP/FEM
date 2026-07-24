# Карта замены документации FEM

Версия: 2.0  
Дата: 2026-07-24  
Цель: DB-first demo-MVP внутреннего инструмента учёта

Все пути указаны относительно корня проекта `FEM-main/`.

## Главное изменение

Старый рабочий контур описывал публичный demo:

```text
главная → календарь → результаты → публичный профиль
```

Новый рабочий контур:

```text
подготовка БД/Admin API
→ спортсмены
→ лошади
→ соревнования
→ категории/классы
→ результаты
→ demo-размещение
```

Отдельный Public API и публичный frontend больше не являются условием первого
показа. Реализованный до смены scope Public API не удаляется и продолжает
проходить regression tests, но не расширяется для demo.

## Заменить обязательно

| Путь                                      | Причина                                    |
| ----------------------------------------- | ------------------------------------------ |
| `FEM_MVP_ACCELERATED_PLAN.md`             | новый основной scope и порядок разработки  |
| `DOCS_REPLACEMENT_MAP.md`                 | новая карта замены                         |
| `docs/README.md`                          | новый порядок чтения                       |
| `docs/MVP_LIMITATIONS.md`                 | ограничения внутреннего demo               |
| `docs/OPEN_QUESTIONS.md`                  | решения для таблиц, категорий и форм       |
| `docs/delivery/ACCEPTANCE_CRITERIA.md`    | DB/API и UI gates вместо Public API gates  |
| `docs/delivery/BACKEND_SCOPE_MATRIX.md`   | повторное использование Admin API          |
| `docs/delivery/CURRENT_QUALITY_STATUS.md` | Public API больше не является blocker demo |
| `docs/delivery/DEVELOPMENT_PLAN.md`       | DB-first последовательность                |
| `docs/delivery/FRONTEND_API_MATRIX.md`    | контракт внутреннего demo-web              |
| `docs/delivery/HANDOFF.md`                | новая команда следующему агенту            |
| `docs/progress/NEXT_ACTION.md`            | начать с DB/API readiness                  |
| `docs/progress/SESSION_STATE.md`          | новая цель текущей сессии                  |
| `docs/progress/TODO.md`                   | новый P0 backlog                           |

## Точечно обновить

| Путь        | Изменение                                                      |
| ----------- | -------------------------------------------------------------- |
| `README.md` | уточнить, что защищённый demo-web может использовать Admin API |

## Оставить без изменений

- `AGENTS.md`;
- `docs/DATABASE_RULES.md`;
- `docs/DATA_DICTIONARY.md`;
- `docs/ENTITY_MATRIX.md`;
- `docs/ER_DIAGRAM.md`;
- `docs/design-constitution.md`;
- `docs/anti-patterns.md`;
- `docs/delivery/ADMIN_API_SECURITY.md`;
- `docs/delivery/QUALITY_GATES.md`;
- `docs/delivery/TESTING_STRATEGY.md`;
- ADR;
- правила миграций и целостности БД.

Эти документы остаются техническими источниками, но не расширяют scope
demo-MVP.

## Считать историческими, не удалять

- `docs/stabilization/**`;
- `docs/database/00-*.md` … `docs/database/05-*.md`;
- `docs/database/*AUDIT*.md`;
- `docs/progress/CHANGELOG_AI.md`;
- `docs/PROJECT_SPEC.md`;
- `docs/GRAPHIFY_INSTALLATION_REPORT.md`;
- `docs/GRAPHIFY_WORKFLOW.md`.

Исторические документы не используются как backlog и не имеют приоритета над
`FEM_MVP_ACCELERATED_PLAN.md`.

## Не создавать сейчас

- новую или расширенную документацию Public API (существующий технический
  контракт сохраняется как исторический/реализованный);
- спецификацию публичной главной/календаря;
- CMS backlog;
- Excel workflow;
- обучение операторов;
- ranking engine specification;
- owner/ownership UI specification;
- deployment runbook уровня production.

## Проверка после замены

В активной документации не должно оставаться утверждений:

- «Public API обязателен для первого demo»;
- «первый MVP — публичный сайт»;
- «полноценный admin-web не входит в demo»;
- «главная, календарь и публичный профиль — обязательные экраны»;
- «Excel блокирует первый показ».

Разрешены упоминания этих функций только как `LATER` или исторический контекст.

## Куда копировать

Распаковать пакет непосредственно в корень `FEM-main/` с сохранением структуры
каталогов и заменой перечисленных файлов.

После замены начать с:

1. `FEM_MVP_ACCELERATED_PLAN.md`;
2. `docs/README.md`;
3. `docs/progress/NEXT_ACTION.md`.

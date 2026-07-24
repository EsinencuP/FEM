# Критерии приёмки FEM demo-MVP

Версия: 3.0

Дата: 2026-07-24

## Уровни

- `DB-MUST` — база/backend готовы к frontend.
- `DEMO-MUST` — обязательно для показа.
- `LATER` — не блокирует demo.

## DB/API gate

| ID    | Критерий                                                | Приоритет |
| ----- | ------------------------------------------------------- | --------- |
| DB-01 | Миграции применяются к чистой PostgreSQL 16             | DB-MUST   |
| DB-02 | Prisma validate/generate проходят                       | DB-MUST   |
| DB-03 | Demo seed повторяем и не создаёт дубли                  | DB-MUST   |
| DB-04 | Есть связанные athlete + horse + event + class + result | DB-MUST   |
| DB-05 | FK и ключевые constraints защищают связи                | DB-MUST   |
| DB-06 | Списки имеют bounded pagination                         | DB-MUST   |
| DB-07 | Filters и sort используют allowlist                     | DB-MUST   |
| DB-08 | Detail responses содержат нужные связи                  | DB-MUST   |
| DB-09 | UI не требует показывать UUID                           | DB-MUST   |
| DB-10 | Create/update основных сущностей работают               | DB-MUST   |
| DB-11 | Ошибки безопасны и содержат requestId                   | DB-MUST   |
| DB-12 | OpenAPI соответствует runtime                           | DB-MUST   |
| DB-13 | lint, typecheck, unit, DB/E2E и build проходят          | DB-MUST   |

## Demo UI

| ID      | Критерий                                                | Приоритет |
| ------- | ------------------------------------------------------- | --------- |
| DEMO-01 | Интерфейс явно обозначен как demo-прототип              | DEMO-MUST |
| DEMO-02 | Работает защищённый вход или подготовленная сессия      | DEMO-MUST |
| DEMO-03 | Таблица спортсменов ищет, фильтрует и сортирует         | DEMO-MUST |
| DEMO-04 | Карточка спортсмена показывает ключевые связи           | DEMO-MUST |
| DEMO-05 | Таблица лошадей ищет, фильтрует и сортирует             | DEMO-MUST |
| DEMO-06 | Карточка лошади показывает ключевые связи               | DEMO-MUST |
| DEMO-07 | Таблица соревнований фильтрует и сортирует              | DEMO-MUST |
| DEMO-08 | В соревновании видны категории/классы                   | DEMO-MUST |
| DEMO-09 | У класса видна связанная таблица результатов            | DEMO-MUST |
| DEMO-10 | Результат показывает спортсмена и лошадь                | DEMO-MUST |
| DEMO-11 | Минимум одна create/update операция работает            | DEMO-MUST |
| DEMO-12 | Pagination/filter/sort работают server-side             | DEMO-MUST |
| DEMO-13 | URL сохраняет состояние таблицы                         | DEMO-MUST |
| DEMO-14 | Loading, empty, filtered-empty, error и 404 различаются | DEMO-MUST |
| DEMO-15 | UUID и технические поля скрыты                          | DEMO-MUST |
| DEMO-16 | Нет raw backend и console errors                        | DEMO-MUST |
| DEMO-17 | Desktop demo не имеет критических layout-дефектов       | DEMO-MUST |
| DEMO-18 | Frontend обращается только к API                        | DEMO-MUST |

## Безопасность demo

| ID     | Критерий                                       | Приоритет |
| ------ | ---------------------------------------------- | --------- |
| SEC-01 | Demo использует отдельную БД                   | DEMO-MUST |
| SEC-02 | Credentials отсутствуют в bundle и репозитории | DEMO-MUST |
| SEC-03 | Auth/permissions проверяются backend           | DEMO-MUST |
| SEC-04 | CSRF, idempotency и If-Match не отключены      | DEMO-MUST |
| SEC-05 | Swagger закрыт или защищён                     | DEMO-MUST |
| SEC-06 | Demo-данные не выдаются за официальные         | DEMO-MUST |

## Что не блокирует demo

Статус `LATER`:

- Public API;
- публичный сайт;
- dashboard;
- Excel;
- обучение;
- CMS/media;
- ranking engine;
- owners UI;
- второй язык;
- полная mobile-оптимизация;
- production SLA;
- внешние интеграции.

## Решение о показе

Показ разрешён, когда все применимые `DB-MUST` и `DEMO-MUST` имеют доказательство
и нет дефекта, который ломает сценарий.

## Gate evidence 2026-07-24

- DB-01—DB-13: PASS — 17 migrations, Prisma validate/generate, 70 unit,
  28 DB, 85 E2E, OpenAPI/types checks и backend build.
- DEMO-01—DEMO-18: PASS для локального production preview — семь routes,
  реальный Admin API, отдельная audit/demo DB, safe update, URL state,
  1/100 pagination, desktop/mobile browser QA.
- SEC-01—SEC-06: PASS для локального preview. Credentials отсутствуют в
  bundle/repository; server-side auth/permissions, CSRF, idempotency и
  `If-Match` сохранены.
- Внешний preview: CONDITIONAL — hosting/DNS/TLS/secret access не
  предоставлен. До размещения Swagger должен быть выключен либо защищён,
  а CORS — ограничен точным HTTPS origin.

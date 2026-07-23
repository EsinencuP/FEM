# План разработки FEM

Версия: 1.0  
Дата: 2026-07-23  
Назначение: путь от текущего backend baseline к связанным frontend и backend

## 1. Исходная точка

На 2026-07-23 в комплекте есть:

- NestJS/TypeScript backend foundation;
- PostgreSQL 16 и Prisma;
- две reviewed Database v1 migrations;
- demo seed;
- модели основных системных и спортивных сущностей;
- health endpoint;
- Swagger/OpenAPI foundation;
- общий формат ответов, Zod validation и request logging;
- базовые CRUD-заготовки для части справочников;
- unit, E2E и database constraint test foundation;
- CI quality gate;
- архитектурная и database-документация.

Ещё не следует считать завершёнными:

- разделение Public/Admin/Integration/Internal API;
- frontend contract;
- полноценные маршруты спортсменов, лошадей, соревнований, результатов,
  рейтингов, новостей, страниц и медиа;
- административная авторизация и 2FA;
- централизованная permission/public-field policy;
- публикационный workflow;
- импорт, экспорт, очереди и webhooks;
- production deployment, мониторинг, backup и recovery;
- финальная формула рейтинга и часть бизнес-справочников.

## 2. Подход

Разработка ведётся contract-first:

1. Фиксируется пользовательский сценарий и acceptance ID.
2. Описывается OpenAPI contract и пример данных.
3. Frontend получает mock server и типы.
4. Frontend и backend развиваются параллельно.
5. Contract tests подтверждают совместимость.
6. Функция проходит E2E и UAT.

Это позволяет начинать frontend немедленно, не ожидая готовности всех backend
модулей.

## 3. Рекомендуемая структура поставки

```text
fem/
  apps/
    public-web/       публичный frontend
    admin-web/        административная панель
    api/              NestJS backend
    worker/           фоновые задачи, если выделяются отдельно
  packages/
    api-contract/     OpenAPI snapshot и сгенерированные типы
    ui/               общие UI-компоненты при необходимости
    config/           общие lint/TypeScript настройки
  docs/
```

Переезд в monorepo не является обязательным для первого коммита. Важнее
сохранить единый версионируемый API contract и независимые pipeline.

## 4. Этапы

### Этап 0. Заморозка MVP и контрактов

Оценка: 3–5 рабочих дней.

Задачи:

- утвердить MVP sitemap и список экранов;
- определить основной и дополнительные языки;
- закрыть блокирующие вопросы из `OPEN_QUESTIONS.md`;
- утвердить публичные поля;
- утвердить статусы соревнований и результатов;
- решить, входит ли официальный рейтинг в первый релиз;
- выбрать frontend stack и hosting;
- утвердить CORS origins, auth approach и media storage;
- создать OpenAPI skeleton Public/Admin API;
- создать mock fixtures без персональных данных;
- связать требования с acceptance ID.

Результат:

- замороженный MVP scope;
- OpenAPI v1 skeleton;
- UI route map;
- список решений и владельцев;
- первый frontend backlog.

Gate: frontend не придумывает поля и статусы вне контракта.

### Этап 1. Public API foundation и frontend shell

Оценка: 1–2 недели.

Backend:

- маршруты `/api/v1/public/{lang}`;
- публичные идентификаторы и slug;
- единая пагинация, фильтры и ошибки;
- allowlist публичных полей;
- locale resolution;
- cache policy;
- OpenAPI examples и contract tests.

Frontend:

- проект, routing, layout, header/footer;
- design tokens и responsive grid;
- API client из OpenAPI;
- mock server;
- loading/empty/error states;
- язык и metadata foundation;
- базовые accessibility checks.

Результат:

- frontend запускается автономно на mock data;
- backend отдаёт первые публичные справочники;
- CI обоих проектов проверяет contract.

Gate: `API-01`–`API-09`, применимые к готовым маршрутам.

### Этап 2. Контент, навигация и медиа

Оценка: 1–2 недели.

Backend:

- news, pages, navigation и media;
- draft/preview/publish/archive;
- безопасная загрузка файлов;
- языковые версии и fallback policy;
- sanitization;
- cache invalidation и search indexing hooks.

Frontend:

- главная;
- новости: список и материал;
- статические страницы;
- динамическая навигация;
- media/document components;
- SEO metadata, sitemap и hreflang.

Admin:

- формы контента;
- media library;
- preview;
- publication validation.

Gate: `PUB-02`–`PUB-04`, `PUB-11`–`PUB-13`, `FIL-01`–`FIL-05`.

### Этап 3. Административный доступ и аудит

Оценка: 1–2 недели.

Backend:

- персональные admin accounts;
- password hashing, 2FA и recovery;
- session lifecycle и revocation;
- CSRF/CORS/security headers;
- `ADMIN` policy;
- audit trail;
- optimistic concurrency;
- idempotency для критических операций;
- rate limiting.

Frontend Admin:

- login и 2FA;
- session management;
- общий CRUD shell;
- conflict UI;
- audit viewer;
- подтверждение критических действий.

Gate: `ADM-01`–`ADM-13`, `SEC-01`–`SEC-06`.

### Этап 4. Спортивные справочники и профили

Оценка: 1–2 недели.

Backend:

- athletes, horses, owners, clubs, disciplines;
- external identifiers;
- исторические связи;
- public/admin projections;
- archive/restore и deduplication controls.

Frontend:

- реестры и карточки спортсменов, лошадей и клубов;
- фильтры, пагинация и поиск;
- связанные результаты;
- admin forms и relation history.

Gate: `PUB-07`, `PUB-09`, `DAT-03`–`DAT-06`.

### Этап 5. Соревнования и результаты

Оценка: 2–3 недели.

Backend:

- calendar и competition details;
- competition classes;
- result draft/validate/approve/publish/correct;
- документы соревнования;
- version history и audit;
- cache/search updates;
- bulk result validation.

Frontend:

- календарь;
- карточка соревнования;
- таблицы результатов;
- фильтры, сортировка и адаптивная mobile-версия;
- admin workflow загрузки и публикации;
- безопасное отображение исправлений.

Gate: `PUB-05`, `PUB-06`, `ADM-05`–`ADM-09`, `DAT-04`, UAT сценарии 2–4.

### Этап 6. Рейтинг

Оценка после утверждения формулы: 1–3 недели.

Задачи:

- формально утвердить definitions, periods, eligibility, formula, rounding,
  tie-break и corrections;
- реализовать versioned calculation configuration;
- добавить reproducible snapshot generation;
- связать entries с source results;
- добавить preview, freeze, publish и supersede;
- сверить контрольный расчёт с FEM;
- реализовать публичные таблицы и историю снимков.

Если формула не утверждена, этап переносится. В первом релизе допустим только
явно обозначенный официальный импортируемый snapshot с provenance.

Gate: `PUB-08`, `DAT-07`, `DAT-08`.

### Этап 7. Импорт, экспорт и интеграции

Оценка: 2–3 недели.

Backend/worker:

- background job model и worker;
- import packages, dry run, row report и conflicts;
- large exports и временные ссылки;
- IntegrationClient и отзыв ключей;
- test mode;
- signed webhooks и retries;
- correlation across request/job/audit.

Admin:

- импорт и preview;
- статус фоновой операции;
- conflict resolution;
- download отчёта;
- управление integrations в разрешённом объёме.

Gate: `INT-01`–`INT-10`, `API-14`.

### Этап 8. Миграция данных и quality review

Оценка зависит от источников: минимум 1–2 недели.

Задачи:

- инвентаризация источников;
- profiling и mapping;
- deduplication report;
- dry run;
- исправление конфликтов владельцем данных;
- staging import;
- count/checksum/relation reconciliation;
- выборочная сверка FEM;
- production migration plan;
- backup и rollback rehearsal.

Gate: `DAT-09`, `DAT-10` и подписанный migration report.

### Этап 9. Hardening, UAT и запуск

Оценка: 1–2 недели.

Задачи:

- полный regression;
- accessibility и browser matrix;
- performance test по согласованному профилю;
- security review;
- observability и alerts;
- backup/restore verification;
- production configuration review;
- UAT;
- release rehearsal;
- launch и post-release monitoring.

Gate: все `MUST` из `ACCEPTANCE_CRITERIA.md`.

## 5. Параллельный рабочий поток

| Поток                 | Начинается сразу              | Зависимость                      |
| --------------------- | ----------------------------- | -------------------------------- |
| Public frontend shell | После route map               | Design tokens и OpenAPI skeleton |
| Public pages          | На mocks                      | Public API contract              |
| Admin shell           | После auth contract           | Session/2FA contract             |
| Backend Public API    | Сразу                         | Public-field и locale decisions  |
| Backend Admin API     | После auth decision           | Security model                   |
| Content/media         | После locale/storage decision | Publication workflow             |
| Sports modules        | После vocabulary decisions    | Database v1                      |
| Results               | После status/field decisions  | Competition modules              |
| Ranking               | Только после формулы          | Results и approved rules         |
| Imports               | После source inventory        | Domain services                  |
| UAT                   | Инкрементально                | Готовые vertical slices          |

## 6. Рекомендуемый порядок frontend

1. App shell, routing, typography, colors и responsive layout.
2. OpenAPI client, mock server и error model.
3. Общие компоненты: table, pagination, filter, card, document, states.
4. Главная, новости и страницы.
5. Календарь и соревнование.
6. Результаты.
7. Профили и поиск.
8. Рейтинг, если входит в релиз.
9. Admin shell и auth.
10. Admin CRUD по тому же порядку доменов.

Каждый экран сначала реализуется на contract fixtures, затем подключается к
staging API без изменения ручных локальных типов.

## 7. Рекомендуемый порядок backend

1. API namespaces, error model, public IDs, pagination и OpenAPI.
2. Auth/session/2FA, permissions, audit, concurrency и idempotency.
3. Content/navigation/media.
4. Public/Admin services для справочников и профилей.
5. Competitions/classes/results.
6. Search и cache invalidation.
7. Ranking после утверждения правил.
8. Jobs, import/export, integrations и webhooks.
9. Observability, rate limits и production hardening.

Public и Admin controllers не должны дублировать бизнес-логику: они используют
общий domain service, но разные projection и authorization policy.

## 8. Definition of Done для задачи

Между каждым крупным этапом применяется
[`QUALITY_GATES.md`](./QUALITY_GATES.md). Следующий этап начинается только со
статусом `GO` либо `CONDITIONAL GO` с явно записанными ограничениями.

Задача завершена, если:

- связана с acceptance ID;
- contract обновлён;
- backend validation и права реализованы;
- frontend имеет loading/empty/error/success states;
- unit/integration tests добавлены;
- критический сценарий включён в E2E;
- миграция reviewed, если меняется схема;
- audit/metrics/logging учтены;
- документация обновлена;
- CI зелёный;
- функция проверена на staging.

## 9. Управление изменениями

- Новая функция не добавляется в MVP без указания влияния на срок и критический
  путь.
- Изменение поля начинается с OpenAPI и migration impact review.
- Неподтверждённое бизнес-правило остаётся configurable/provisional либо не
  реализуется.
- Любое исключение из критериев приёмки содержит владельца, риск и срок.
- Рейтинг не блокирует остальные модули, пока формула не утверждена.

## 10. Оценка календаря

При одном full-stack разработчике реалистичный диапазон первого production
релиза — примерно 12–18 недель после закрытия блокирующих решений и получения
контента/данных.

При раздельных frontend и backend потоках часть этапов выполняется параллельно,
и ориентир может сократиться до 9–13 недель. Оценка не включает длительное
согласование формулы рейтинга, юридические проверки и очистку неизвестного
объёма исходных данных.

Окончательный срок фиксируется только после Этапа 0 и декомпозиции backlog.

## 11. Ближайшие действия

1. Утвердить MVP и языки.
2. Ответить на блокирующие вопросы auth, hosting, storage и public fields.
3. Зафиксировать OpenAPI skeleton.
4. Создать frontend и подключить mock API.
5. Завершить Public API foundation.
6. Реализовывать vertical slices: contract → backend → frontend → E2E → UAT.

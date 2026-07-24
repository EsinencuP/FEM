# Frontend API matrix — demo-web

Version: 3.0-verified

Updated: 2026-07-24  
Owner: DB-first demo contract

## Purpose

Контракт между внутренним demo-web и существующим защищённым Admin API.

Уже существующий Public API и будущий публичный frontend не входят в первый
demo. Demo-web не вызывает Public API и использует защищённые Admin routes.

## Stage 0 demo decisions

До отдельного решения FEM применяются следующие явно provisional настройки:

- язык интерфейса — русский;
- данные — только вымышленные записи с `isDemo=true`;
- категории классов:
  - `Открытый класс (демо)`;
  - `Юниоры (демо)`;
  - `Любители (демо)`;
  - `Молодые лошади (демо)`;
- безопасная mutation для показа — изменение `venue` у demo-соревнования;
- внутренний `id` используется только для routes/API и не выводится как
  пользовательская колонка;
- `version` хранится клиентом для `If-Match`, но не показывается как
  редактируемое поле.

Эти значения не являются официальными справочниками или бизнес-правилами FEM.

## Visible fields and minimal forms

| Resource    | Видимые колонки                                                                 | Минимальная форма                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Athlete     | основной код, имя, страна, текущий клуб, статус, дата изменения                 | `firstName`, `lastName`, `displayName`, `countryId`, `nationalFederationId`, `status`                                                                    |
| Horse       | основной код, имя, паспортное имя, пол, порода, год рождения, страна, статус    | `displayName`, `passportName`, `sex`, `breed`, `color`, `birthYear`, `countryOfBirthId`, `status`                                                        |
| Competition | название, даты, место/площадка, страна, статус, количество классов              | `title`, `slug`, `startDate`, `endDate`, `location`, `venue`, `countryId`, `organizerName`, `status`                                                     |
| Class       | название, дисциплина, категория, уровень, дата, порядок, количество результатов | `competitionEventId`, `title`, `disciplineId`, `category`, `level`, `competitionDate`, `sortOrder`, `status`                                             |
| Result      | место/статус, спортсмен, лошадь, отображаемый результат, баллы, время, штрафы   | `competitionClassId`, `athleteId`, `horseId`, `rank`, `statusId`, `resultDisplay`, `points`, `timeSeconds`, `penalties`; минимум один outcome обязателен |

Дата рождения спортсмена не является колонкой общего списка. Owners,
publication workflow, archive/restore и технические поля в demo UI не
выводятся.

## Global contract

| Concern            | Contract                                |
| ------------------ | --------------------------------------- |
| Base path          | `/api/v1`                               |
| Demo resources     | `/admin/*`                              |
| Authentication     | HttpOnly session + действующий 2FA flow |
| State changes      | CSRF                                    |
| POST replay safety | `Idempotency-Key`                       |
| PATCH concurrency  | `If-Match` + conflict UI                |
| Pagination         | `page`, `limit`, maximum 100            |
| Sorting            | allowlisted `sortBy` + `sortOrder`      |
| Stable order       | requested sort, then `id`               |
| List response      | `data[]` + `meta`                       |
| Error              | safe body + `requestId`                 |
| Archive default    | `archived=false`                        |
| UI state           | filters/sort/page in URL                |

## Athletes

Route: `/admin/athletes`

| Function | Parameters                                                  |
| -------- | ----------------------------------------------------------- |
| Search   | `search`                                                    |
| Filters  | `countryId`, `federationId`, `clubId`, `status`, `archived` |
| Sort     | `lastName`, `displayName`, `createdAt`, `updatedAt`         |
| Page     | `page`, `limit`                                             |

Detail/actions:

- `GET /admin/athletes/:id`;
- `POST /admin/athletes`;
- `PATCH /admin/athletes/:id`;
- `GET /admin/athletes/:id/clubs`;
- `GET /admin/athletes/:id/horses`;
- `GET /admin/athletes/:id/results`;
- `GET /admin/athletes/:id/identifiers`.

List item возвращает `currentClubs[]` (без предположения «только один клуб») и
nullable `primaryIdentifier`. Оба значения загружаются bounded/batched без
per-row requests.

## Horses

Route: `/admin/horses`

| Function | Parameters                                                                     |
| -------- | ------------------------------------------------------------------------------ |
| Search   | `search`                                                                       |
| Filters  | `sex`, `breed`, `color`, `birthYear`, `countryOfBirthId`, `status`, `archived` |
| Sort     | `displayName`, `passportName`, `birthYear`, `createdAt`                        |
| Page     | `page`, `limit`                                                                |

Detail/actions:

- `GET /admin/horses/:id`;
- `POST /admin/horses`;
- `PATCH /admin/horses/:id`;
- `GET /admin/horses/:id/athletes`;
- `GET /admin/horses/:id/results`;
- `GET /admin/horses/:id/identifiers`.

List item возвращает nullable `primaryIdentifier`. Horse detail дополнительно
возвращает до 10 последних `competitionResults` и до 20
`externalIdentifiers`, поэтому карточке не нужен N+1.

## Generated TypeScript contract

- источник: `api-client/openapi/openapi.json`;
- типы: `api-client/generated/schema.d.ts`;
- обновление: `pnpm openapi:export`, затем `pnpm openapi:types`;
- проверка drift: `pnpm openapi:check` и `pnpm openapi:types:check`;
- списки спортсменов и лошадей типизированы как `AthleteListItem` и
  `HorseListItem`.

## Competitions

Route: `/admin/competitions`

| Function | Parameters                                                                          |
| -------- | ----------------------------------------------------------------------------------- |
| Search   | `search`                                                                            |
| Filters  | `countryId`, `disciplineId`, `status`, `dateFrom`, `dateTo`, `upcoming`, `archived` |
| Sort     | `startDate`, `endDate`, `title`, `createdAt`                                        |
| Page     | `page`, `limit`                                                                     |

Detail/actions:

- `GET /admin/competitions/:id`;
- `POST /admin/competitions`;
- `PATCH /admin/competitions/:id`;
- `GET /admin/competitions/:id/classes`;
- `GET /admin/competitions/:id/results`.

`publicationStatus` может оставаться техническим фильтром, но demo UI не должен
создавать отдельный publication workflow.

Вложенные `/:id/classes` и `/:id/results` используют только bounded
`page/limit`. Они не принимают `sortBy/sortOrder`; frontend не должен
переносить query contract top-level списков на nested routes.

## Competition classes

Route: `/admin/competition-classes`

| Function | Parameters                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------- |
| Filters  | `competitionEventId`, `disciplineId`, `category`, `level`, `status`, `competitionDate`, `archived` |
| Sort     | `competitionDate`, `sortOrder`, `title`, `createdAt`                                               |
| Page     | `page`, `limit`                                                                                    |

Detail/actions:

- `GET /admin/competition-classes/:id`;
- `POST /admin/competition-classes`;
- `PATCH /admin/competition-classes/:id`;
- `GET /admin/competition-classes/:id/results`.

Demo frontend группирует классы по `category` внутри соревнования. Отдельный
resource `CompetitionCategory` не требуется.

## Results

Route: `/admin/results`

| Function | Parameters                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Filters  | `competitionEventId`, `competitionClassId`, `athleteId`, `horseId`, `disciplineId`, `statusId`, `statusCode`, `hasRank`, `archived` |
| Sort     | `rank`, `points`, `timeSeconds`, `penalties`, `createdAt`                                                                           |
| Page     | `page`, `limit`                                                                                                                     |

Detail/actions:

- `GET /admin/results/:id`;
- `POST /admin/results`;
- `PATCH /admin/results/:id`.

Строка результата должна включать readable projections класса, соревнования,
спортсмена, лошади и статуса.

## Lookup resources

Для select/filter controls переиспользуются:

- `/admin/countries`;
- `/admin/disciplines`;
- `/admin/clubs`.

Новый lookup route создаётся только если существующий list contract не подходит
по bounded pagination или projection.

Demo seed использует provisional DRAFT records. Поэтому lookup не добавляет
`status=ACTIVE` автоматически: archived rows скрываются contract default, а
доступные статусы остаются частью фактических Admin данных.

## Frontend rules

1. Не отправлять arbitrary database fields в `sortBy`.
2. Не выполнять client-side sort полного dataset.
3. Не загружать все страницы ради фильтра.
4. Не делать N+1 detail requests для строк таблицы.
5. Не показывать UUID.
6. Не хранить session/recovery codes в browser storage.
7. Не повторять POST с новым idempotency key после неизвестного результата.
8. При 409 перечитать запись и показать conflict.
9. Не превращать ошибку API в empty state.
10. Генерировать типы из актуального OpenAPI.

## Demo scenario traceability

| Шаг demo                          | Frontend route      | Admin API                                                                                                  |
| --------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Вход                              | `/login`            | `POST /api/v1/auth/login`, затем `GET /api/v1/auth/me`                                                     |
| Реестр спортсменов                | `/athletes`         | `GET/POST /api/v1/admin/athletes`, lookups countries/clubs                                                 |
| Карточка спортсмена               | `/athletes/:id`     | `GET/PATCH /api/v1/admin/athletes/:id`, вложенные `clubs`, `horses`, `results`, `identifiers`              |
| Реестр лошадей                    | `/horses`           | `GET/POST /api/v1/admin/horses`, lookup countries                                                          |
| Карточка лошади                   | `/horses/:id`       | `GET/PATCH /api/v1/admin/horses/:id`, вложенные `athletes`, `results`, `identifiers`                       |
| Реестр соревнований               | `/competitions`     | `GET/POST /api/v1/admin/competitions`, lookups countries/disciplines                                       |
| Соревнование, классы и результаты | `/competitions/:id` | `GET/PATCH /api/v1/admin/competitions/:id`, `GET/POST/PATCH competition-classes`, `GET/POST/PATCH results` |
| Безопасное изменение              | `/competitions/:id` | `PATCH /api/v1/admin/competitions/:id` с CSRF и `If-Match`; изменяется только `venue` demo-записи          |

Отдельные routes для класса, результата, owners, dashboard и Public API не
создаются.

## Contract gate

- [x] все DEMO-MUST экраны имеют route;
- [x] нужные filters/sort задокументированы;
- [x] list responses не требуют N+1;
- [x] create/update contracts и security headers проверены E2E;
- [x] OpenAPI snapshot и generated TypeScript contract актуальны;
- [x] 401/403/404/409 имеют стабильные безопасные контракты.

Итог Этапа 3: **PASS**.

Runtime consumer verification Этапов 4–6: **PASS**. Все семь routes используют
этот contract; browser QA подтвердил login, lists/details, nested
classes/results, URL state и безопасный competition PATCH.

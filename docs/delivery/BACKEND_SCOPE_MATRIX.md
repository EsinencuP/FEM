# Матрица backend scope для demo-MVP

Дата актуализации: 2026-07-24

| Область                   | Текущее состояние            | Нужно для demo | Решение                          |
| ------------------------- | ---------------------------- | -------------- | -------------------------------- |
| PostgreSQL/Prisma         | широкий baseline готов       | да             | не переписывать                  |
| Миграции                  | 17 последовательных миграций | да             | clean PG16 gate пройден          |
| Athletes API              | CRUD/read, filters/sort      | да             | переиспользовать                 |
| Horses API                | CRUD/read, filters/sort      | да             | переиспользовать                 |
| Competitions API          | CRUD/read, filters/sort      | да             | переиспользовать                 |
| Classes API               | CRUD/read, category/level    | да             | переиспользовать                 |
| Results API               | CRUD/read, filters/sort      | да             | переиспользовать                 |
| Человекочитаемые проекции | основные проекции есть       | да             | проверить consumer gaps          |
| Admin security            | реализована                  | да             | использовать, не отключать       |
| Audit                     | foundation есть              | backend-only   | отдельный UI позже               |
| OpenAPI                   | snapshot/checksum актуальны  | да             | генерировать typed client        |
| Demo seed                 | безопасен, идемпотентен      | да             | presentation gate пройден        |
| Demo frontend             | реализован в `apps/demo-web` | да             | 7 routes, не расширять scope     |
| Public API                | уже реализован и тестируется | нет            | не расширять в demo sprint       |
| Public frontend           | отсутствует                  | нет            | `LATER`                          |
| Excel                     | storage есть, API нет        | нет            | после demo                       |
| Full admin modules        | отсутствуют                  | нет            | не расширять                     |
| CMS/media                 | частично foundation          | нет            | `LATER`                          |
| Ranking                   | storage есть, формулы нет    | нет            | `LATER`                          |
| Owners/history            | модели есть                  | нет            | `LATER`                          |
| Worker/queue              | отсутствуют                  | нет            | не добавлять                     |
| Search engine             | отсутствует                  | нет            | SQL filters + trigram достаточно |

## Активные ресурсы

`Country`, `NationalFederation`, `Discipline`, `Club`, `Athlete`, `Horse`,
`AthleteClubMembership`, `AthleteHorseRelation`, `CompetitionEvent`,
`CompetitionClass`, `CompetitionResult`, `ResultStatus`,
`ExternalIdentifier`, `AuditLog`.

## Допустимые backend-изменения

- добавить отсутствующее поле в list/detail projection;
- добавить индекс только после подтверждённого запроса;
- исправить фильтр/сортировку;
- синхронизировать DTO/OpenAPI;
- расширить demo seed;
- добавить точечный contract test.

Уже реализованный Public API не удаляется: это безопаснее, чем ломать
действующий контракт и миграции. Он не становится источником требований
demo-web, который использует только защищённый Admin API.

## Запрещённое расширение

- расширение Public API или публичного сайта;
- новая таблица категорий без решения FEM;
- универсальный importer;
- новые домены, не участвующие в demo;
- смена backend stack.

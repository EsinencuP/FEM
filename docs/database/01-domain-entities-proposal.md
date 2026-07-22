# Domain Entities Proposal

- Автор предложения: Domain Data Analyst
- Статус: proposal for Lead Database Architect review
- Дата: 2026-07-22
- Область: `Athlete`, `Horse`, `Club`, `Owner`, `Discipline`, `Country`, `NationalFederation`, `AthleteClubMembership`, `AthleteHorseRelation`, `HorseOwnership`

## 1. Границы и принципы

Этот документ описывает информационную модель первого рабочего этапа. Он не устанавливает официальные правила Национальной федерации конного спорта Молдовы.

Применены следующие ограничения:

- каждая сущность и каждая историческая связь получает внутренний UUID;
- UUID никогда не трактуется как FEI ID, национальный номер, лицензия, паспорт или микрочип;
- FEI ID, national ID, license number, passport number, microchip и другие внешние номера не генерируются;
- официальные идентификаторы не предлагается хранить в доменных primary key; они должны управляться через `ExternalIdentifier` после согласования governance-модели;
- неизвестные справочники пола, статуса, породы, масти, studbook и типа связи не превращаются в официальные enum до получения подтверждённых перечней;
- персональные контактные данные и копии документов владельцев и спортсменов в эту модель не входят;
- исторические связи моделируются отдельными таблицами с `startDate` и nullable `endDate`;
- отсутствие `endDate` означает «интервал открыт», а не подтверждённое официальное состояние;
- параллельные активные связи не запрещаются без подтверждённого правила. В частности, спортсмен может быть связан с несколькими клубами/лошадьми, а лошадь — с несколькими совладельцами;
- физическое удаление основных записей не является штатной операцией; для них предусмотрен `archivedAt`;
- `isDemo` позволяет отделять демонстрационные записи, но production isolation не должна опираться только на этот флаг.

### Легенда таблиц

- **Обязательность**: `да` означает технический инвариант первой версии; `нет` — nullable из-за неполноты источника или неподтверждённого правила.
- **Уникальность**: ограничение, предлагаемое на уровне БД; `нет` не отменяет дедупликацию в import/service layer.
- **Природа**: `internal` — системное/редакционное значение; `official` — может представлять значение официального источника только при наличии source/verification trail.
- **Доступ**: предполагаемая максимальная видимость. Фактическая публикация должна контролироваться API и политикой персональных данных.
- **Статус**: `confirmed` означает подтверждённое заданием или техническим стандартом; `provisional` — требует решения Федерации/Lead Architect.

## 2. Справочники

### 2.1 Country

Страна — нормализованный справочник для спортсменов, клубов, федераций, лошадей и событий. ISO-коды берутся из контролируемого ISO 3166-1 источника и не придумываются системой.

| Поле         | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность | Источник                  | Природа  | Доступ   | Статус    |
| ------------ | --------------------------------------------- | -------------- | ------------ | ------------------------- | -------- | -------- | --------- |
| `id`         | `String @id @default(uuid()) @db.Uuid`        | да             | PK           | система                   | internal | internal | confirmed |
| `isoAlpha2`  | `String @db.Char(2)`                          | да             | unique       | ISO 3166-1                | official | public   | confirmed |
| `isoAlpha3`  | `String @db.Char(3)`                          | да             | unique       | ISO 3166-1                | official | public   | confirmed |
| `name`       | `String`                                      | да             | нет          | контролируемый справочник | official | public   | confirmed |
| `isDemo`     | `Boolean @default(false)`                     | да             | нет          | система/seed              | internal | internal | confirmed |
| `archivedAt` | `DateTime? @db.Timestamptz(3)`                | нет            | нет          | система/администратор     | internal | internal | confirmed |
| `createdAt`  | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет          | система                   | internal | internal | confirmed |
| `updatedAt`  | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет          | система                   | internal | internal | confirmed |

Предлагаемые проверки: сохранять ISO-коды в верхнем регистре; проверять длину и ASCII-формат миграционным `CHECK`. Локализация названий стран требует отдельной модели/решения и не подменяется JSON.

### 2.2 NationalFederation

Запись представляет национальную федерацию как организацию. Ограничение «ровно одна федерация на страну» не вводится до подтверждения организационной модели.

| Поле           | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность | Источник                         | Природа  | Доступ   | Статус                                     |
| -------------- | --------------------------------------------- | -------------- | ------------ | -------------------------------- | -------- | -------- | ------------------------------------------ |
| `id`           | `String @id @default(uuid()) @db.Uuid`        | да             | PK           | система                          | internal | internal | confirmed                                  |
| `countryId`    | `String @db.Uuid`                             | да             | нет          | администратор/импорт             | official | public   | confirmed                                  |
| `name`         | `String`                                      | да             | нет          | официальный источник организации | official | public   | confirmed                                  |
| `abbreviation` | `String?`                                     | нет            | нет          | официальный источник организации | official | public   | provisional                                |
| `websiteUrl`   | `String?`                                     | нет            | нет          | официальный источник организации | official | public   | provisional                                |
| `status`       | `String`                                      | да             | нет          | внутренний workflow              | internal | public   | confirmed as field; vocabulary provisional |
| `isDemo`       | `Boolean @default(false)`                     | да             | нет          | система/seed                     | internal | internal | confirmed                                  |
| `archivedAt`   | `DateTime? @db.Timestamptz(3)`                | нет            | нет          | система/администратор            | internal | internal | confirmed                                  |
| `createdAt`    | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет          | система                          | internal | internal | confirmed                                  |
| `updatedAt`    | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет          | система                          | internal | internal | confirmed                                  |

Официальный FEI federation code, если он потребуется, следует хранить как внешний идентификатор с источником и verification metadata, а не объявлять `abbreviation` таким кодом.

### 2.3 Discipline

`Discipline` — управляемый справочник. До утверждения официального перечня его значения не следует считать официальной классификацией Федерации.

| Поле          | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность               | Источник                           | Природа  | Доступ   | Статус                                         |
| ------------- | --------------------------------------------- | -------------- | -------------------------- | ---------------------------------- | -------- | -------- | ---------------------------------------------- |
| `id`          | `String @id @default(uuid()) @db.Uuid`        | да             | PK                         | система                            | internal | internal | confirmed                                      |
| `code`        | `String`                                      | да             | unique after normalization | администратор/утверждённый импорт  | internal | public   | confirmed as technical key; values provisional |
| `name`        | `String`                                      | да             | нет                        | администратор/официальный источник | official | public   | confirmed as field; values provisional         |
| `description` | `String?`                                     | нет            | нет                        | редакция                           | internal | public   | provisional                                    |
| `status`      | `String`                                      | да             | нет                        | внутренний workflow                | internal | public   | confirmed as field; vocabulary provisional     |
| `isDemo`      | `Boolean @default(false)`                     | да             | нет                        | система/seed                       | internal | internal | confirmed                                      |
| `archivedAt`  | `DateTime? @db.Timestamptz(3)`                | нет            | нет                        | система/администратор              | internal | internal | confirmed                                      |
| `createdAt`   | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет                        | система                            | internal | internal | confirmed                                      |
| `updatedAt`   | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет                        | система                            | internal | internal | confirmed                                      |

`code` должен нормализоваться (trim + uppercase) и служить стабильным техническим ключом API/import. Это не FEI code без отдельной верификации.

## 3. Организации и спортивные субъекты

### 3.1 Club

| Поле                   | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность | Источник                          | Природа  | Доступ   | Статус                                     |
| ---------------------- | --------------------------------------------- | -------------- | ------------ | --------------------------------- | -------- | -------- | ------------------------------------------ |
| `id`                   | `String @id @default(uuid()) @db.Uuid`        | да             | PK           | система                           | internal | internal | confirmed                                  |
| `name`                 | `String`                                      | да             | нет          | администратор/импорт              | official | public   | confirmed                                  |
| `legalName`            | `String?`                                     | нет            | нет          | официальный реестр/организация    | official | public   | provisional                                |
| `countryId`            | `String @db.Uuid`                             | да             | нет          | администратор/импорт              | official | public   | confirmed                                  |
| `nationalFederationId` | `String? @db.Uuid`                            | нет            | нет          | федерация/верифицированный импорт | official | public   | provisional                                |
| `status`               | `String`                                      | да             | нет          | внутренний workflow               | internal | public   | confirmed as field; vocabulary provisional |
| `isDemo`               | `Boolean @default(false)`                     | да             | нет          | система/seed                      | internal | internal | confirmed                                  |
| `archivedAt`           | `DateTime? @db.Timestamptz(3)`                | нет            | нет          | система/администратор             | internal | internal | confirmed                                  |
| `createdAt`            | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет          | система                           | internal | internal | confirmed                                  |
| `updatedAt`            | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет          | система                           | internal | internal | confirmed                                  |

Название клуба само по себе недостаточно для unique constraint: одноимённые организации возможны. Дедупликация должна учитывать страну, legal name и проверенные внешние идентификаторы.

### 3.2 Athlete

| Поле                   | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность | Источник                                   | Природа  | Доступ                | Статус                                     |
| ---------------------- | --------------------------------------------- | -------------- | ------------ | ------------------------------------------ | -------- | --------------------- | ------------------------------------------ |
| `id`                   | `String @id @default(uuid()) @db.Uuid`        | да             | PK           | система                                    | internal | internal              | confirmed                                  |
| `firstName`            | `String`                                      | да             | нет          | спортсмен/федерация/импорт                 | official | public                | confirmed                                  |
| `lastName`             | `String`                                      | да             | нет          | спортсмен/федерация/импорт                 | official | public                | confirmed                                  |
| `displayName`          | `String`                                      | да             | нет          | редакция или детерминированное отображение | internal | public                | confirmed                                  |
| `dateOfBirth`          | `DateTime? @db.Date`                          | нет            | нет          | верифицированный источник                  | official | internal by default   | provisional publication/access             |
| `gender`               | `String?`                                     | нет            | нет          | верифицированный источник/self-report      | official | internal by default   | provisional vocabulary/access              |
| `countryId`            | `String? @db.Uuid`                            | нет            | нет          | федерация/импорт                           | official | public                | provisional semantics                      |
| `nationalFederationId` | `String? @db.Uuid`                            | нет            | нет          | федерация/импорт                           | official | public                | provisional                                |
| `photoId`              | `String? @db.Uuid`                            | нет            | нет          | редакция/media workflow                    | internal | public when published | confirmed as optional relation             |
| `status`               | `String`                                      | да             | нет          | внутренний workflow                        | internal | public                | confirmed as field; vocabulary provisional |
| `isDemo`               | `Boolean @default(false)`                     | да             | нет          | система/seed                               | internal | internal              | confirmed                                  |
| `archivedAt`           | `DateTime? @db.Timestamptz(3)`                | нет            | нет          | система/администратор                      | internal | internal              | confirmed                                  |
| `createdAt`            | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет          | система                                    | internal | internal              | confirmed                                  |
| `updatedAt`            | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет          | система                                    | internal | internal              | confirmed                                  |

`countryId` требует уточнения смысла: гражданство, спортивное представительство или страна проживания — разные понятия. До ответа поле nullable и не должно называться citizenship в API. FEI ID, national ID и license number находятся вне этой таблицы.

### 3.3 Horse

| Поле               | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность | Источник                                 | Природа  | Доступ                | Статус                                        |
| ------------------ | --------------------------------------------- | -------------- | ------------ | ---------------------------------------- | -------- | --------------------- | --------------------------------------------- |
| `id`               | `String @id @default(uuid()) @db.Uuid`        | да             | PK           | система                                  | internal | internal              | confirmed                                     |
| `passportName`     | `String?`                                     | нет            | нет          | паспорт/верифицированный импорт          | official | public                | confirmed as optional field                   |
| `displayName`      | `String`                                      | да             | нет          | редакция/импорт                          | internal | public                | confirmed                                     |
| `dateOfBirth`      | `DateTime? @db.Date`                          | нет            | нет          | паспорт/верифицированный источник        | official | public                | confirmed as optional field                   |
| `birthYear`        | `Int? @db.SmallInt`                           | нет            | нет          | верифицированный источник/оценка импорта | official | public                | confirmed as fallback; precedence provisional |
| `sex`              | `String?`                                     | нет            | нет          | паспорт/верифицированный источник        | official | public                | provisional vocabulary                        |
| `breed`            | `String?`                                     | нет            | нет          | паспорт/верифицированный источник        | official | public                | provisional normalization                     |
| `color`            | `String?`                                     | нет            | нет          | паспорт/верифицированный источник        | official | public                | provisional vocabulary                        |
| `countryOfBirthId` | `String? @db.Uuid`                            | нет            | нет          | паспорт/верифицированный источник        | official | public                | provisional availability                      |
| `studbook`         | `String?`                                     | нет            | нет          | паспорт/studbook source                  | official | public                | provisional normalization                     |
| `imageId`          | `String? @db.Uuid`                            | нет            | нет          | редакция/media workflow                  | internal | public when published | confirmed as optional relation                |
| `status`           | `String`                                      | да             | нет          | внутренний workflow                      | internal | public                | confirmed as field; vocabulary provisional    |
| `isDemo`           | `Boolean @default(false)`                     | да             | нет          | система/seed                             | internal | internal              | confirmed                                     |
| `archivedAt`       | `DateTime? @db.Timestamptz(3)`                | нет            | нет          | система/администратор                    | internal | internal              | confirmed                                     |
| `createdAt`        | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет          | система                                  | internal | internal              | confirmed                                     |
| `updatedAt`        | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет          | система                                  | internal | internal              | confirmed                                     |

Если известна точная `dateOfBirth`, `birthYear` либо остаётся null, либо должен совпадать с годом даты; это техническое согласование можно обеспечить `CHECK`. Нельзя требовать хотя бы одно из этих полей: импорт может быть неполным. FEI ID, passport number и microchip хранятся отдельно как внешние идентификаторы.

### 3.4 Owner

`Owner` — минимальная сторона владения, способная представлять физическое лицо или организацию. Модель намеренно не хранит адрес, email, телефон, ID-документы или платёжные сведения.

| Поле          | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность | Источник                  | Природа  | Доступ              | Статус                                      |
| ------------- | --------------------------------------------- | -------------- | ------------ | ------------------------- | -------- | ------------------- | ------------------------------------------- |
| `id`          | `String @id @default(uuid()) @db.Uuid`        | да             | PK           | система                   | internal | internal            | confirmed                                   |
| `displayName` | `String`                                      | да             | нет          | владелец/федерация/импорт | official | internal by default | confirmed as field; publication provisional |
| `ownerType`   | `String?`                                     | нет            | нет          | владелец/импорт           | official | internal by default | provisional vocabulary                      |
| `countryId`   | `String? @db.Uuid`                            | нет            | нет          | владелец/импорт           | official | internal by default | provisional semantics                       |
| `status`      | `String`                                      | да             | нет          | внутренний workflow       | internal | internal            | confirmed as field; vocabulary provisional  |
| `isDemo`      | `Boolean @default(false)`                     | да             | нет          | система/seed              | internal | internal            | confirmed                                   |
| `archivedAt`  | `DateTime? @db.Timestamptz(3)`                | нет            | нет          | система/администратор     | internal | internal            | confirmed                                   |
| `createdAt`   | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет          | система                   | internal | internal            | confirmed                                   |
| `updatedAt`   | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет          | система                   | internal | internal            | confirmed                                   |

Нужно отдельно решить, допустима ли публичная публикация имени владельца и требуется ли различать person/legal entity. До этого `displayName` доступен только внутренним ролям.

## 4. Исторические связи

### 4.1 AthleteClubMembership

Хранит историю отношений спортсмена с клубом. Модель не ограничивает спортсмена одним клубом и не предполагает пожизненную связь.

| Поле             | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность                        | Источник                  | Природа  | Доступ   | Статус                                                |
| ---------------- | --------------------------------------------- | -------------- | ----------------------------------- | ------------------------- | -------- | -------- | ----------------------------------------------------- |
| `id`             | `String @id @default(uuid()) @db.Uuid`        | да             | PK                                  | система                   | internal | internal | confirmed                                             |
| `athleteId`      | `String @db.Uuid`                             | да             | composite exact-duplicate candidate | администратор/импорт      | official | public   | confirmed                                             |
| `clubId`         | `String @db.Uuid`                             | да             | composite exact-duplicate candidate | администратор/импорт      | official | public   | confirmed                                             |
| `startDate`      | `DateTime @db.Date`                           | да             | composite exact-duplicate candidate | верифицированный источник | official | public   | confirmed as interval field; availability provisional |
| `endDate`        | `DateTime? @db.Date`                          | нет            | нет                                 | верифицированный источник | official | public   | confirmed                                             |
| `membershipType` | `String?`                                     | нет            | нет                                 | федерация/клуб            | official | public   | provisional vocabulary                                |
| `isDemo`         | `Boolean @default(false)`                     | да             | нет                                 | система/seed              | internal | internal | confirmed                                             |
| `archivedAt`     | `DateTime? @db.Timestamptz(3)`                | нет            | нет                                 | система/администратор     | internal | internal | confirmed                                             |
| `createdAt`      | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет                                 | система                   | internal | internal | confirmed                                             |
| `updatedAt`      | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет                                 | система                   | internal | internal | confirmed                                             |

Рекомендуемый exact-duplicate key после review: `(athleteId, clubId, startDate, membershipType)`; из-за nullable `membershipType` PostgreSQL unique не устранит все null-дубликаты без expression/partial index. Поэтому окончательный механизм следует согласовать с governance reviewer. Обязателен `CHECK (endDate IS NULL OR endDate >= startDate)`. Запрет пересечений не вводится: одновременно допустимые членства пока неизвестны.

### 4.2 AthleteHorseRelation

Хранит временную связь спортсмена с лошадью без предположения, что спортсмен является владельцем. Значение `relationType` может описывать rider/trainer/other только после утверждения словаря.

| Поле           | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность                        | Источник                  | Природа  | Доступ   | Статус                                                |
| -------------- | --------------------------------------------- | -------------- | ----------------------------------- | ------------------------- | -------- | -------- | ----------------------------------------------------- |
| `id`           | `String @id @default(uuid()) @db.Uuid`        | да             | PK                                  | система                   | internal | internal | confirmed                                             |
| `athleteId`    | `String @db.Uuid`                             | да             | composite exact-duplicate candidate | администратор/импорт      | official | public   | confirmed                                             |
| `horseId`      | `String @db.Uuid`                             | да             | composite exact-duplicate candidate | администратор/импорт      | official | public   | confirmed                                             |
| `relationType` | `String`                                      | да             | composite exact-duplicate candidate | федерация/импорт          | official | public   | confirmed as field; vocabulary provisional            |
| `startDate`    | `DateTime @db.Date`                           | да             | composite exact-duplicate candidate | верифицированный источник | official | public   | confirmed as interval field; availability provisional |
| `endDate`      | `DateTime? @db.Date`                          | нет            | нет                                 | верифицированный источник | official | public   | confirmed                                             |
| `disciplineId` | `String? @db.Uuid`                            | нет            | нет                                 | федерация/импорт          | official | public   | provisional                                           |
| `isDemo`       | `Boolean @default(false)`                     | да             | нет                                 | система/seed              | internal | internal | confirmed                                             |
| `archivedAt`   | `DateTime? @db.Timestamptz(3)`                | нет            | нет                                 | система/администратор     | internal | internal | confirmed                                             |
| `createdAt`    | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет                                 | система                   | internal | internal | confirmed                                             |
| `updatedAt`    | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет                                 | система                   | internal | internal | confirmed                                             |

Рекомендуемый exact-duplicate key: `(athleteId, horseId, relationType, startDate, disciplineId)` с тем же caveat для nullable `disciplineId`. Обязателен `CHECK` порядка дат. Нельзя запрещать несколько активных спортсменов у одной лошади без официального правила.

### 4.3 HorseOwnership

Хранит историю владения и поддерживает совладение. Это информационная запись, не доказательство права собственности.

| Поле             | Тип Prisma / PostgreSQL                       | Обязательность | Уникальность                        | Источник                  | Природа  | Доступ              | Статус                                                |
| ---------------- | --------------------------------------------- | -------------- | ----------------------------------- | ------------------------- | -------- | ------------------- | ----------------------------------------------------- |
| `id`             | `String @id @default(uuid()) @db.Uuid`        | да             | PK                                  | система                   | internal | internal            | confirmed                                             |
| `horseId`        | `String @db.Uuid`                             | да             | composite exact-duplicate candidate | владелец/федерация/импорт | official | internal by default | confirmed                                             |
| `ownerId`        | `String @db.Uuid`                             | да             | composite exact-duplicate candidate | владелец/федерация/импорт | official | internal by default | confirmed                                             |
| `startDate`      | `DateTime @db.Date`                           | да             | composite exact-duplicate candidate | верифицированный источник | official | internal by default | confirmed as interval field; availability provisional |
| `endDate`        | `DateTime? @db.Date`                          | нет            | нет                                 | верифицированный источник | official | internal by default | confirmed                                             |
| `ownershipShare` | `Decimal? @db.Decimal(5,2)`                   | нет            | нет                                 | верифицированный источник | official | internal by default | provisional                                           |
| `isDemo`         | `Boolean @default(false)`                     | да             | нет                                 | система/seed              | internal | internal            | confirmed                                             |
| `archivedAt`     | `DateTime? @db.Timestamptz(3)`                | нет            | нет                                 | система/администратор     | internal | internal            | confirmed                                             |
| `createdAt`      | `DateTime @default(now()) @db.Timestamptz(3)` | да             | нет                                 | система                   | internal | internal            | confirmed                                             |
| `updatedAt`      | `DateTime @updatedAt @db.Timestamptz(3)`      | да             | нет                                 | система                   | internal | internal            | confirmed                                             |

Рекомендуемый exact-duplicate key: `(horseId, ownerId, startDate)`. Обязательны `CHECK (endDate IS NULL OR endDate >= startDate)` и, если `ownershipShare` задан, `CHECK (ownershipShare > 0 AND ownershipShare <= 100)`. Сумму долей в 100% нельзя требовать: источники могут быть неполными, а официальное правило не подтверждено.

## 5. Связи и referential actions

| От                             | К                                         | Кардинальность             | Предлагаемое поведение FK                                                      | Обоснование                                                              |
| ------------------------------ | ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `NationalFederation.countryId` | `Country.id`                              | many-to-one                | `Restrict`                                                                     | справочник нельзя удалить при наличии федераций                          |
| `Club.countryId`               | `Country.id`                              | many-to-one                | `Restrict`                                                                     | сохранение исторической целостности                                      |
| `Club.nationalFederationId`    | `NationalFederation.id`                   | many-to-one optional       | `SetNull` only after explicit archive workflow; otherwise `Restrict` preferred | принадлежность provisional, потеря истории нежелательна                  |
| `Athlete.countryId`            | `Country.id`                              | many-to-one optional       | `SetNull`                                                                      | источник может быть исправлен; Country обычно архивируется, не удаляется |
| `Athlete.nationalFederationId` | `NationalFederation.id`                   | many-to-one optional       | `SetNull` only on exceptional hard delete                                      | официальный контекст nullable                                            |
| `Athlete.photoId`              | `MediaFile.id`                            | zero-or-one                | `SetNull`                                                                      | удаление/замена media не удаляет спортсмена                              |
| `Horse.countryOfBirthId`       | `Country.id`                              | many-to-one optional       | `SetNull`                                                                      | неполные сведения допустимы                                              |
| `Horse.imageId`                | `MediaFile.id`                            | zero-or-one                | `SetNull`                                                                      | удаление/замена media не удаляет лошадь                                  |
| `Owner.countryId`              | `Country.id`                              | many-to-one optional       | `SetNull`                                                                      | семантика страны provisional                                             |
| `AthleteClubMembership`        | `Athlete`, `Club`                         | many-to-one с обеих сторон | `Restrict`                                                                     | история не должна исчезать каскадно                                      |
| `AthleteHorseRelation`         | `Athlete`, `Horse`, optional `Discipline` | many-to-one                | `Restrict`; optional discipline may be `SetNull`                               | сохранение истории                                                       |
| `HorseOwnership`               | `Horse`, `Owner`                          | many-to-one                | `Restrict`                                                                     | история владения не должна исчезать каскадно                             |

Для основных доменных и исторических таблиц `Cascade` не рекомендуется. Архивация parent не должна автоматически архивировать связи: это отдельное аудируемое действие.

## 6. Индексы для типовых API-операций

Предложение для дальнейшего quality review:

- `Country(isoAlpha2)`, `Country(isoAlpha3)` — unique;
- `NationalFederation(countryId, archivedAt)`;
- `Discipline(code)` — normalized unique;
- `Club(countryId, status, archivedAt)` и `Club(nationalFederationId, archivedAt)`;
- `Athlete(lastName, firstName)`, `Athlete(countryId, status, archivedAt)`, `Athlete(nationalFederationId, archivedAt)`;
- `Horse(displayName)`, `Horse(passportName)`, `Horse(countryOfBirthId, status, archivedAt)`;
- `Owner(displayName)`, `Owner(countryId, archivedAt)`;
- `AthleteClubMembership(athleteId, startDate, endDate)`, `(clubId, startDate, endDate)`;
- `AthleteHorseRelation(athleteId, startDate, endDate)`, `(horseId, startDate, endDate)`, `(disciplineId, endDate)`;
- `HorseOwnership(horseId, startDate, endDate)`, `(ownerId, startDate, endDate)`.

Для быстрых current-list queries полезны PostgreSQL partial indexes `WHERE end_date IS NULL AND archived_at IS NULL`. Prisma schema не выражает все partial/check/exclusion constraints, поэтому их следует добавить reviewable SQL в миграцию и задокументировать.

## 7. Official identifiers boundary

Рекомендуемое распределение, подлежащее утверждению агентом Data Governance:

| Сущность             | Не хранить как доменное поле              | Причина                                                                       |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| `Athlete`            | FEI ID, national ID, license number       | внешние идентификаторы имеют собственный issuer/source/verification lifecycle |
| `Horse`              | FEI ID, passport number, microchip        | номера не генерируются и могут иметь разные issuing authorities               |
| `Club`               | registration number, federation club code | требуют namespace и source                                                    |
| `NationalFederation` | FEI federation code                       | `abbreviation` не должна неявно становиться официальным ID                    |
| `Owner`              | national/company registration number      | чувствительность и governance требуют отдельного решения                      |

Имена и демографические атрибуты не являются уникальными идентификаторами. По ним нельзя автоматически объединять записи.

## 8. Provisional decisions for Lead Architect

1. Смысл `Athlete.countryId`: гражданство, представляемая страна или иное.
2. Допустимость публичного `dateOfBirth` и `gender`; предлагаем private-by-default.
3. Словари `status`, `gender`, `sex`, `breed`, `color`, `studbook`, `membershipType`, `relationType`, `ownerType`.
4. Обязательность `startDate`, если legacy import сообщает только текущую связь без даты. Предложение: не выдумывать дату; предусмотреть controlled import exception или отдельную `startDateKnown`-стратегию до реализации importer.
5. Публичность владельцев и правовое основание обработки.
6. Возможность нескольких активных клубных членств и athlete–horse relations. По умолчанию разрешить, пока правило не подтверждено.
7. Способ запрета exact duplicates при nullable составляющих: expression unique index, service validation или normalized sentinel недопустим без review.
8. Нужны ли локализованные названия справочников и организаций; отдельная translation-модель предпочтительнее JSON.
9. Требуется ли `ownershipShare`; поле допустимо только nullable и без предположения о сумме 100%.
10. Нужно ли выделить `Breed`, `Color`, `Studbook` в отдельные справочники после получения официальных источников.

## 9. Предлагаемый итог

Модель нормализует основные справочники и доменные субъекты, сохраняет временную историю связей и не зашивает неподтверждённые спортивные правила. Официальные идентификаторы остаются отдельным governance-контуром. Lead Database Architect должен согласовать proposal с предложениями по identifiers, competitions, ranking и migration quality до изменения `schema.prisma`.

# Entity Matrix

- Статус: audited MVP baseline matrix
- Область: базовые справочники, спортивные субъекты и исторические связи
- Дата: 2026-07-22

## Матрица сущностей

| Сущность                | Назначение                         | Внутренний PK | Основные связи                                       | Историческая | Soft delete  | Demo flag | Официальные ID                                         | Предлагаемая публичность                      | Уверенность                                      |
| ----------------------- | ---------------------------------- | ------------- | ---------------------------------------------------- | ------------ | ------------ | --------- | ------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------ |
| `Country`               | ISO-справочник стран               | UUID          | federation, club, athlete, horse, owner              | нет          | `archivedAt` | `isDemo`  | ISO alpha-2/alpha-3 в самой таблице                    | public                                        | confirmed                                        |
| `NationalFederation`    | организация национальной федерации | UUID          | country, clubs, athletes                             | нет          | `archivedAt` | `isDemo`  | через `ExternalIdentifier`                             | public                                        | структура confirmed; атрибуты provisional        |
| `Discipline`            | управляемый справочник дисциплин   | UUID          | athlete–horse relation и будущие competition/ranking | нет          | `archivedAt` | `isDemo`  | внешний официальный код отдельно, если появится        | public                                        | структура confirmed; vocabulary provisional      |
| `Club`                  | спортивный клуб/организация        | UUID          | country, federation, memberships                     | нет          | `archivedAt` | `isDemo`  | через `ExternalIdentifier`                             | public                                        | confirmed with provisional federation relation   |
| `Athlete`               | профиль спортсмена                 | UUID          | country, federation, photo, memberships, horses      | нет          | `archivedAt` | `isDemo`  | FEI/national/license через `ExternalIdentifier`        | public profile; DOB/gender private by default | confirmed core; semantics provisional            |
| `Horse`                 | профиль лошади                     | UUID          | birth country, image, athletes, owners               | нет          | `archivedAt` | `isDemo`  | FEI/passport/microchip через `ExternalIdentifier`      | public                                        | confirmed core; vocabularies provisional         |
| `Owner`                 | минимальная сторона владения       | UUID          | country, ownership history                           | нет          | `archivedAt` | `isDemo`  | внешний номер только при отдельном governance decision | internal by default                           | structure confirmed; privacy provisional         |
| `AthleteClubMembership` | история спортсмен–клуб             | UUID          | athlete, club                                        | да           | `archivedAt` | `isDemo`  | отсутствуют                                            | public only if policy allows                  | confirmed structure; overlap rules provisional   |
| `AthleteHorseRelation`  | история спортсмен–лошадь           | UUID          | athlete, horse, optional discipline                  | да           | `archivedAt` | `isDemo`  | отсутствуют                                            | public only if policy allows                  | confirmed structure; relation types provisional  |
| `HorseOwnership`        | история владельцев/совладельцев    | UUID          | horse, owner                                         | да           | `archivedAt` | `isDemo`  | отсутствуют                                            | internal by default                           | confirmed structure; legal semantics provisional |

## Матрица связей

| Сторона A            | Связующая сущность / FK             | Сторона B              | Кардинальность | Интервал                 | Одновременные активные связи                        | Delete policy                           |
| -------------------- | ----------------------------------- | ---------------------- | -------------- | ------------------------ | --------------------------------------------------- | --------------------------------------- |
| `Country`            | `NationalFederation.countryId`      | `NationalFederation`   | 1:N            | нет                      | разрешены до подтверждения правила «одна на страну» | Restrict/archive                        |
| `Country`            | `Club.countryId`                    | `Club`                 | 1:N            | нет                      | разрешены                                           | Restrict/archive                        |
| `NationalFederation` | `Club.nationalFederationId`         | `Club`                 | 1:N optional   | нет                      | не применимо                                        | Restrict preferred                      |
| `Country`            | `Athlete.countryId`                 | `Athlete`              | 1:N optional   | нет                      | не применимо                                        | SetNull only on exceptional hard delete |
| `NationalFederation` | `Athlete.nationalFederationId`      | `Athlete`              | 1:N optional   | нет                      | одна текущая scalar-ссылка, но её смысл provisional | SetNull only on exceptional hard delete |
| `Athlete`            | `AthleteClubMembership`             | `Club`                 | M:N            | `startDate`–`endDate`    | разрешены до официального решения                   | Restrict                                |
| `Athlete`            | `AthleteHorseRelation`              | `Horse`                | M:N            | `startDate`–`endDate`    | разрешены                                           | Restrict                                |
| `Discipline`         | `AthleteHorseRelation.disciplineId` | athlete–horse relation | 1:N optional   | наследует интервал связи | несколько дисциплин допустимы                       | SetNull or Restrict                     |
| `Horse`              | `HorseOwnership`                    | `Owner`                | M:N            | `startDate`–`endDate`    | разрешены для совладения                            | Restrict                                |
| `MediaFile`          | `Athlete.photoId`                   | `Athlete`              | 1:N optional   | нет                      | одно выбранное фото на профиль                      | SetNull                                 |
| `MediaFile`          | `Horse.imageId`                     | `Horse`                | 1:N optional   | нет                      | одно выбранное изображение на профиль               | SetNull                                 |

## Матрица полей по сущностям

Подробные источник, природа, видимость и статус каждого поля приведены в [database/01-domain-entities-proposal.md](database/01-domain-entities-proposal.md). Ниже — контроль полноты полей для интеграции Lead Architect.

| Сущность                | Required поля                                       | Nullable confirmed поля                               | Nullable provisional поля                                    | Технические поля                                       |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `Country`               | `isoAlpha2`, `isoAlpha3`, `name`                    | —                                                     | —                                                            | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `NationalFederation`    | `countryId`, `name`, `status`                       | —                                                     | `abbreviation`, `websiteUrl`                                 | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `Discipline`            | `code`, `name`, `status`                            | —                                                     | `description`                                                | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `Club`                  | `name`, `countryId`, `status`                       | —                                                     | `legalName`, `nationalFederationId`                          | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `Athlete`               | `firstName`, `lastName`, `displayName`, `status`    | `photoId`                                             | `dateOfBirth`, `gender`, `countryId`, `nationalFederationId` | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `Horse`                 | `displayName`, `status`                             | `passportName`, `dateOfBirth`, `birthYear`, `imageId` | `sex`, `breed`, `color`, `countryOfBirthId`, `studbook`      | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `Owner`                 | `displayName`, `status`                             | —                                                     | `ownerType`, `countryId`                                     | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `AthleteClubMembership` | `athleteId`, `clubId`, `startDate`                  | `endDate`                                             | `membershipType`                                             | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `AthleteHorseRelation`  | `athleteId`, `horseId`, `relationType`, `startDate` | `endDate`                                             | `disciplineId`                                               | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |
| `HorseOwnership`        | `horseId`, `ownerId`, `startDate`                   | `endDate`                                             | `ownershipShare`                                             | `id`, `isDemo`, `archivedAt`, `createdAt`, `updatedAt` |

## Identifier placement matrix

| Идентификатор             | Субъект                                  | Генерируется системой                   | Primary key | Предлагаемое место   | Unique scope пока известен?                          |
| ------------------------- | ---------------------------------------- | --------------------------------------- | ----------- | -------------------- | ---------------------------------------------------- |
| internal UUID             | все сущности                             | да                                      | да          | основная таблица     | global per table                                     |
| FEI ID                    | athlete/horse/federation, если применимо | нет                                     | нет         | `ExternalIdentifier` | требует issuer/entity policy                         |
| national ID               | athlete, если утверждён                  | нет                                     | нет         | `ExternalIdentifier` | не подтверждён                                       |
| license number            | athlete/club, если утверждён             | нет                                     | нет         | `ExternalIdentifier` | не подтверждён                                       |
| passport number           | horse                                    | нет                                     | нет         | `ExternalIdentifier` | требует issuer/normalization policy                  |
| microchip                 | horse                                    | нет                                     | нет         | `ExternalIdentifier` | требует normalization/verification policy            |
| ISO alpha-2/alpha-3       | country                                  | нет                                     | нет         | `Country`            | globally unique by ISO standard                      |
| discipline technical code | discipline                               | задаётся администратором/import mapping | нет         | `Discipline.code`    | unique after normalization, но не официальный FEI ID |

## Инварианты, предлагаемые для БД

| Инвариант                                               | Механизм                                                   | Статус                             |
| ------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| UUID не переиспользуется                                | immutable PK; никакой генерации из official ID             | confirmed                          |
| `endDate >= startDate`                                  | SQL `CHECK` для всех исторических связей                   | confirmed                          |
| `birthYear` согласован с `dateOfBirth`, если оба заданы | SQL `CHECK`                                                | recommended technical invariant    |
| `ownershipShare` в диапазоне `(0, 100]`, если задана    | SQL `CHECK`                                                | provisional field, safe validation |
| ISO codes имеют фиксированную длину и uppercase ASCII   | column length + SQL `CHECK`                                | confirmed                          |
| архивированные parent records не удаляются каскадно     | `Restrict` FK + service archive workflow                   | confirmed                          |
| только одна текущая связь                               | не вводить до подтверждения конкретного отношения          | provisional/open                   |
| exact duplicate temporal relation                       | composite/partial/expression index после governance review | provisional implementation         |

## Границы ответственности

- Эта матрица не определяет competition, result, ranking, user, audit, import, media или document fields.
- `MediaFile` показан только как внешний dependency для `photoId`/`imageId`.
- `ExternalIdentifier` показан только как граница хранения официальных ID; его структура, normalization, verification и uniqueness принадлежат предложению Data Governance.
- `status` присутствует по заданию, но его значения не считаются официальными, пока словари не утверждены.
- Никаких registration/application/payment сущностей модель не предполагает.

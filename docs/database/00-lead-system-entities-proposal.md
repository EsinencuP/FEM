# Lead Proposal: System Entities

- Автор: Lead Database Architect
- Статус: proposal for Agent 5 review
- Область: `User`, `Role`, `UserRole`, `AuditLog`, `ImportBatch`, `ImportRow`, `MediaFile`, `Document`

## Границы

Эти таблицы создают storage foundation, но не реализуют authentication, authorization policy, importer, file storage или document workflow. Все primary keys — внутренние UUID. Пароли, токены, cookies, authorization headers и database URLs не хранятся ни в одной из таблиц.

## User

| Поле | Тип | Required | Unique | Решение |
| --- | --- | --- | --- | --- |
| `id` | UUID | да | PK | internal, immutable |
| `email` | text | да | normalized unique | login/contact locator; auth не реализуется |
| `displayName` | text | да | нет | internal profile label |
| `status` | text/internal enum | да | нет | internal lifecycle, не official |
| `isDemo` | boolean | да | нет | demo isolation |
| `archivedAt` | timestamptz | нет | нет | soft delete |
| `createdAt`, `updatedAt` | timestamptz | да | нет | lifecycle |

Email normalisation v1: trim + lowercase for technical uniqueness. User не содержит password hash до отдельного auth ADR.

## Role and UserRole

`Role` содержит UUID, unique internal `code`, `name`, nullable `description`, `isSystem`, `isDemo`, `archivedAt`, timestamps. Коды ролей не определяют permissions до отдельной policy.

`UserRole` содержит UUID, required `userId`/`roleId`, `startDate`, nullable `endDate`, nullable `assignedById`, `isDemo`, `archivedAt`, timestamps. Обязателен `CHECK (endDate IS NULL OR endDate >= startDate)`. Exact duplicate active assignment должен блокироваться partial unique index по `(userId, roleId) WHERE endDate IS NULL AND archivedAt IS NULL`; это технический, не предметный инвариант.

## AuditLog

| Поле | Тип | Required | Решение |
| --- | --- | --- | --- |
| `id` | UUID | да | immutable PK |
| `actorId` | UUID FK User | нет | system/import actions допустимы без actor |
| `action` | text | да | internal audited action code |
| `entityType` | text | да | polymorphic target type |
| `entityId` | UUID | да | target UUID; application-enforced target integrity |
| `oldData`, `newData` | JSONB | нет | redacted snapshots only |
| `reason` | text | нет | required by service for critical correction/merge/archive |
| `requestId` | text | нет | request correlation |
| `createdAt` | timestamptz | да | append timestamp |

AuditLog не получает `updatedAt`/`archivedAt`: штатное изменение и удаление запрещены. Индексы: `(entityType, entityId, createdAt)`, `(actorId, createdAt)`, `(requestId)`.

## ImportBatch

Поля: UUID; required `entityType`, `sourceType`, `filename`, `checksum`, internal `status`; non-negative `totalRows`, `successRows`, `failedRows`; nullable `createdById`; `isDemo`; `createdAt`; nullable `completedAt`.

Безопасные ограничения:

- counters неотрицательны;
- `successRows + failedRows <= totalRows`;
- checksum не объявляется global unique: один файл может быть намеренно повторно проверен; сервис выявляет предыдущий batch и требует explicit decision;
- `(checksum, sourceType, entityType, createdAt)` индексируется для поиска повторов.

## ImportRow

Поля: UUID; required `importBatchId`, positive `rowNumber`, JSONB `rawData`; nullable JSONB `normalizedData`; internal `status`; nullable `errorMessage`; nullable polymorphic `linkedEntityType`/`linkedEntityId`; `createdAt`.

`@@unique([importBatchId, rowNumber])` предотвращает duplicate row. Raw/normalized JSON — evidence/reserve layer, не замена нормализованным таблицам. Secrets и неразрешённые sensitive values должны удаляться до persistence.

## MediaFile

Поля: UUID; unique `storageKey`; `filename`; `mimeType`; non-negative `sizeBytes` (`BigInt`); nullable `checksum`, `altText`, `credit`; internal `status`; `isDemo`; `archivedAt`; timestamps.

Запись хранит metadata, не binary content. Storage provider и signed URL policy остаются open. Архивация media не каскадирует удаление Athlete/Horse/Event.

## Document

Поля: UUID; `title`; nullable provisional `documentType`; nullable `mediaFileId`; nullable `sourceUrl`; nullable `issuedAt`; internal `publicationStatus`; `isDemo`; `archivedAt`; timestamps.

Document — источник/метаданные, не хранилище чувствительных удостоверений. Требуется хотя бы `mediaFileId` или `sourceUrl` на service layer; публичность и retention provisional. Результаты и identifiers используют restrictive relation к source document, чтобы provenance не исчезал.

## Общие решения

- Domain/history/evidence relations используют `Restrict`/`NoAction`; `SetNull` допустим только для actor/optional presentation media.
- System lifecycle vocabularies — внутренние enums (`RecordStatus`, `PublicationStatus`, import statuses); они не являются Federation/FEI codes.
- Polymorphic targets (`AuditLog`, `ImportRow`) проверяются transaction service + integration tests в v1; общий entity registry отложен как open architecture option.
- Все applicable records имеют `isDemo`; AuditLog/ImportRow наследуют demo boundary от actor/batch/target и не требуют дублирующего флага, кроме ImportBatch.

## Open questions

1. Identity provider и lifecycle пользователя.
2. Permission model и утверждённые role codes.
3. Audit/import/document retention и legal erasure.
4. File storage provider, malware scanning, signed URLs и allowed MIME types.
5. Полиморфная referential integrity: service validation или shared registry в следующей версии.
6. Trusted import sources и правила повторного checksum.

# Database Rules

## Базовые ограничения

1. Основная СУБД — PostgreSQL. MongoDB и SQLite не используются.
2. `DATABASE_URL` поступает только из environment configuration и никогда не коммитится с реальными credentials.
3. Локальная разработка использует PostgreSQL 16 из `docker-compose.yml` и отдельный persistent named volume.
4. Production credentials запрещено использовать локально или в CI.
5. `PrismaClient` создаётся только через глобальный `PrismaService`; сервисы не создают собственные экземпляры.

## Internal identity and official identifiers

- Все основные сущности используют внутренний UUID в PostgreSQL как primary key.
- Внутренний UUID создаётся системой, неизменяем, никогда не переиспользуется и не имеет официального значения.
- UUID нельзя показывать или описывать как FEI ID, national ID, licence number, passport number или microchip.
- Foreign keys ссылаются на внутренние UUID; официальные и внешние номера не используются как primary/foreign keys.
- FEI ID, national ID, licence number, passport number, microchip и external event/source codes не генерируются платформой.
- В v1 официальные и внешние номера хранятся централизованно в `ExternalIdentifier`, а не в прямых nullable-колонках основных сущностей.
- Маршрутные значения вроде event slug не являются официальными идентификаторами и могут храниться в основной таблице.
- Архивация записи не освобождает её UUID или официальный идентификатор для повторного использования.

## ExternalIdentifier

- Каждая запись идентификатора содержит собственный UUID, тип целевой сущности, UUID цели, тип идентификатора, namespace/issuer, исходное значение и нормализованное значение.
- Для трассируемости сохраняются `normalizationVersion`, verification status, source document/reference, verifier и verification timestamp, если они доступны.
- Tuple `(namespace, identifierType, normalizedValue)` должен быть уникальным, включая archived identifiers. Совпадение с другой сущностью является конфликтом.
- Exact match того же tuple и той же сущности обрабатывается идемпотентно; он не создаёт дубликат.
- Способ обеспечения referential integrity для polymorphic `entityType + entityId` должен быть утверждён Lead Architect: application transaction с тестами, nullable FKs с SQL `CHECK` или shared entity registry.
- Словари identifier types/namespaces, primary-display policy, public visibility и trusted verification sources остаются provisional до подтверждения.

## Нормализация и верификация

- Оригинальное значение сохраняется отдельно от comparison value.
- Без подтверждённых правил issuer безопасная baseline-нормализация ограничена Unicode NFKC и удалением пробелов по краям.
- Нельзя удалять пунктуацию, пробелы внутри, ведущие нули, префиксы или check digits без подтверждённого правила namespace.
- Case folding допустим для canonical uniqueness только после подтверждения case-insensitive semantics.
- Нормализация выполняется одним versioned и покрытым тестами модулем для API, import и seed.
- Изменение normalization policy требует versioned backfill и предварительного collision report.
- Verification является внутренним результатом проверки источника и не означает официальную сертификацию Федерации/FEI.
- Verification сохраняет источник, verifier, timestamp и audit event; новые данные не считаются verified автоматически без утверждённой trusted-source policy.
- Пароли, токены, cookies, authorization headers, полные database URLs и иные секреты запрещено хранить в provenance и verification data.

## Дубликаты и слияния

- Имена, даты и similarity score могут создать только candidate для review; они не доказывают identity.
- Автоматическое слияние Athlete, Horse, Owner, Club, CompetitionEvent или официальных идентификаторов запрещено.
- Exact identifier collision между разными UUID блокирует write/import и переводится в конфликт для ручной проверки.
- Импорт не связывает ambiguous row и не генерирует отсутствующий официальный ID.
- Reviewed merge выбирает survivor UUID, переносит допустимые ссылки одной транзакцией, сохраняет исторические интервалы, архивирует duplicate и создаёт audit event с actor/reason/request ID.
- UUID архивированного duplicate никогда не переиспользуется.
- Детальные правила определены в `docs/database/DEDUPLICATION_RULES.md`.

## Soft delete and historical data

- Для официальных и предметных записей используется `archivedAt` и, где необходимо, внутренний status. Physical delete не является штатной операцией API.
- Archive/restore являются явными audited actions.
- Архивация не каскадируется на историю клубов, владельцев, спортсмен–лошадь, результаты, audit, imports или external identifiers.
- Для historical/evidence foreign keys используется `RESTRICT`/`NO ACTION`, если иное не обосновано отдельным решением.
- Approval actor является частью evidence pair: `CompetitionResult.approvedById` и `RankingRuleSet.approvedById` используют `RESTRICT`; для удаления actor approval сначала должен быть явно и аудируемо отозван.
- Cascade допустим только для зависимых технических записей без самостоятельной исторической/доказательной ценности и должен быть документирован.
- Hard delete допустим только для контролируемой очистки local demo/test, rejected pre-acceptance staging data или утверждённого legal erasure workflow.
- Retention, anonymization и legal erasure requirements по Молдове/ЕС остаются открытым вопросом; soft delete сам по себе не является compliance policy.

## Audit trail

- Критические изменения записываются в append-only на application level `AuditLog`, по возможности в той же DB transaction, что и domain write.
- Audit обязателен для identifier create/change/verification/conflict/archive/reassignment, merges, archive/restore, import linking decisions и критических publication/ranking/permission changes.
- Audit содержит actor, action, entity type/UUID, redacted old/new data, reason, request ID и timestamp.
- Audit не хранит passwords, tokens, cookies, authorization headers, database URLs или unredacted sensitive document contents.
- Физическое изменение или удаление audit events запрещено штатным runtime role; сроки хранения требуют отдельного юридического решения.

## Import governance

- `ImportBatch` фиксирует source, filename, checksum и outcome counters; checksum защищает от случайного повторного файла, но не доказывает идентичность сущностей.
- `ImportRow` хранит разрешённые raw/normalized data, status/error и ссылку на сущность только после deterministic match или reviewed decision.
- Перед созданием/привязкой official identifier обязательны централизованная нормализация и unique-conflict check по active и archived данным.
- Ambiguous rows остаются unlinked/conflicted; auto-verification зависит только от будущей утверждённой source trust policy.

## Prisma schema и миграции

- Исторический инфраструктурный этап содержал только `generator client` и `datasource db`; текущий MVP baseline содержит согласованные модели Database v1 и не расширяется без отдельного архитектурного решения.
- Каждое изменение schema сопровождается именованной migration и review сгенерированного SQL.
- `prisma migrate dev` разрешён только для локальной development database.
- `prisma migrate deploy` применяется в controlled deployment к заранее проверенным миграциям.
- `prisma db push`, reset и ручное destructive SQL не являются штатным production-процессом.
- Миграции после общего использования не переписываются; исправление выполняется новой миграцией.
- Перед migration creation выполняются `prisma format`, `prisma validate`, `prisma generate` и review planned schema diff.
- SQL review проверяет `DROP`, type rewrites, nullability, foreign-key actions, indexes и unique constraints; destructive changes без отдельного плана запрещены.
- Перед добавлением unique identifier constraint выполняются duplicate/null preflight queries и документируется разрешение конфликтов.
- Новые required-поля в заполненных таблицах вводятся через expand/backfill/validate/contract, а не одним небезопасным шагом.
- Renormalization identifiers требует versioned backfill, collision report и repair/rollback plan.
- На больших production-таблицах способ создания индексов оценивается отдельно; при необходимости используется reviewed concurrent index migration.
- Production migration требует утверждённых backup/recovery, observability, ownership и maintenance/zero-downtime procedure.

## Данные и безопасность

- В `.env.example` используются только placeholders.
- Database URL, пароли и connection strings должны редактироваться в логах и diagnostic output.
- Для staging/production нужны отдельные пользователи БД с минимальными правами.
- Migration role и runtime role рекомендуется разделить.
- Перед production необходимо определить backup, restore test, retention, encryption и incident procedure.
- Demo/test data маркируются `isDemo` там, где это предусмотрено, и не смешиваются с production datasets.
- Raw imports, audit JSON и metadata проходят redaction и data-minimization review; JSON не используется вместо нормализованной модели без документированной причины.

## Managed PostgreSQL

Supabase PostgreSQL может быть выбран как managed hosting для staging/production. В этом случае приложение продолжает использовать стандартный PostgreSQL connection string через Prisma. Supabase SDK не добавляется в business layer без отдельного архитектурного решения.

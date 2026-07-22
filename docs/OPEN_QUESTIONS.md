# Open Questions

Вопросы оставлены открытыми намеренно; ответы не требуются для каркаса первого этапа и не подменяются вымышленными бизнес-правилами.

## Platform and operations

- Какой managed PostgreSQL provider будет утверждён для staging и production?
- Нужен ли внешний connection pooler и какие лимиты соединений действуют у выбранного provider?
- Где будут храниться и ротироваться secrets: GitHub Environments, cloud secret manager или другой approved vault?
- Каковы требования к backup retention, point-in-time recovery и регулярным restore tests?
- Какая observability platform будет собирать логи, метрики и traces?
- Где будет размещён backend и как организуются zero-downtime migrations?

## API and security

- Какие точные origins разрешить CORS для будущего frontend?
- Какой identity provider и authentication protocol будут утверждены?
- Нужны ли API versioning policy, rate limits и public/private API separation?
- Как публиковать и проверять изменения OpenAPI contract для frontend-команды?
- Какие требования к audit trail и хранению персональных данных применимы по законодательству Молдовы и ЕС?

## Delivery

- Какие protected branch rules и обязательные reviewers будут настроены?
- Нужны ли отдельные staging smoke tests с временной тестовой базой?
- Какая стратегия dependency updates и security scanning будет принята?

## Identity, privacy and governance

- Какой identity provider, lifecycle пользователя, permission model и набор role codes будут утверждены?
- Каковы правила публичности даты рождения, пола, владельцев, external identifiers и provenance?
- Каковы сроки хранения, anonymization/legal erasure и audit retention по требованиям Молдовы и ЕС?
- Нужен ли в следующей версии database-enforced entity registry вместо application-enforced polymorphic targets?
- Кто может merge, verify, archive, restore, approve и publish; нужен ли four-eyes control?

## Official identifiers and imports

- Какие identifier types/namespaces официально поддерживаются и какие из них публичны/primary?
- Какие issuer-specific правила case, punctuation, leading zeros и check digits утверждены?
- Какие источники являются trusted и когда external identifier считается verified?
- Допустимо ли переиспользование официального номера источником и как отражать исправления?
- Какие форматы импорта, правила повторного checksum и retention raw rows утверждены?

## Domain vocabularies and temporal rules

- Каковы официальные справочники gender/sex, discipline, category, level, club/athlete/horse status и relation types?
- Может ли спортсмен одновременно состоять в нескольких клубах и может ли лошадь иметь нескольких активных спортсменов?
- Как трактовать co-ownership и должен ли total ownership share равняться 100%?
- Что делать с исторической связью, если точная start date неизвестна? Система не будет придумывать дату.
- Какие поля спортсменов, лошадей и владельцев обязательны для официальной публикации?

## Competitions and results

- Какие спортивные result-status codes и их отображение официально утверждены?
- Возможны ли несколько результатов одной пары в одном классе из-за фаз, раундов или corrections?
- Каковы единицы, precision, диапазоны и семантика penalties, time, points, bonus и дополнительных metrics?
- Как определяется порядок ranked и status-only результатов, ties/ex-aequo и corrections опубликованных данных?
- Кто утверждает и публикует event/result, и какие source documents обязательны?

## Rankings

- Какие ranking definitions, disciplines и subject types официально поддерживаются?
- Как определяются period, cutoff, season, rolling window и timezone?
- Какова утверждённая formula, precision, rounding, coefficients, eligibility, tie-breaking и dropped-result policy?
- Как выбирается comparison snapshot и обрабатываются late results, corrections, withdrawal и supersession?
- Допустима ли публикация imported snapshot без известной формулы источника?
- Какие ranking fields и source provenance являются публичными?
- Нужен ли криптографический hash/signature frozen configuration и source dataset?

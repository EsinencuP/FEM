# Этапы проверки и контроля качества

Дата: 2026-07-23

Этот checklist применяется после каждого backend-инкремента. Доказательством
служат команда, тест, HTTP-проверка или review SQL/OpenAPI — не только наличие
кода.

## Data gate

- обязательность, nullable и уникальность соответствуют baseline;
- UUID и официальные identifiers не смешиваются;
- athlete/horse/club/owner/event/class/result relations целостны;
- временные связи имеют корректные интервалы;
- archive/restore не удаляет связанные данные;
- дубликаты и пересечение интервалов проверяются согласно documented policy;
- migration review выполнен, если схема менялась;
- повторный seed не удваивает данные.

## API gate

- create, update, get, list, archive и restore проверены;
- search, filters, sort и pagination проверены, включая максимум limit;
- единые success/error envelopes и HTTP codes подтверждены;
- DTO отклоняют неизвестные и системные поля;
- 400, 404, 409 и 503 не раскрывают stack/SQL;
- OpenAPI соответствует зарегистрированным маршрутам;
- list queries не возвращают unlimited relation graphs.

## Negative and domain gate

- пустые/длинные/неверные значения и UUID отклоняются;
- отрицательные числа и неправильные даты отклоняются;
- отсутствующие и архивные dependencies не используются;
- дата event/class и relation intervals согласованы;
- draft/archived content не попадает в public projection;
- повторные archive/restore имеют документированное поведение;
- неподтверждённые правила не становятся скрытой бизнес-логикой.

## Content, localization and public gate

- news/pages/navigation/media поддерживают draft, preview, publish, archive;
- RU/RO completeness, fallback и диакритика проверены;
- SEO URL, redirect, canonical, sitemap и hreflang проверены;
- public API использует allowlist, pagination и только published records;
- internal, audit и import metadata отсутствуют в public response;
- search покрывает profiles, clubs, competitions, news и pages.

## Security and operations gate

- секреты отсутствуют в Git и ответах;
- auth, permissions и 2FA покрыты до открытия Admin API;
- request size, rate limit и CORS разделены по API surface;
- correlation ID проходит через HTTP, audit, jobs и integrations;
- критические изменения журналируются без секретов;
- database outage, restart, graceful shutdown и retry проверены;
- background jobs и idempotent operations безопасны при повторе;
- monitoring, alerts, backup и restore имеют evidence.

## Documentation gate

- README, env list, OpenAPI, filters, sort, archive и limitations актуальны;
- примеры request/response/error существуют;
- Public/Admin/Internal/Integration boundaries описаны;
- миграции и открытые вопросы отражают фактический код.

## Решение

- **GO** — обязательные сценарии и regression зелёные, критических ограничений нет.
- **CONDITIONAL GO** — следующий инкремент допустим, ограничения и риск записаны.
- **NO-GO** — есть нарушение целостности, безопасности, build/test или контракта.

Любое исправление проходит повторный targeted test и полный regression gate.

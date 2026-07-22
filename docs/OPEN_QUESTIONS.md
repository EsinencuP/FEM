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

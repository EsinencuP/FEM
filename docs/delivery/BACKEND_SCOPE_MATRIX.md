# Матрица backend scope

Дата: 2026-07-23

| Область | Источник инструкций | Текущее состояние | Следующий gate |
| --- | --- | --- | --- |
| База данных | `DATABASE_RULES`, `MVP_DATABASE_BASELINE`, database audit | Baseline существует, в этом инкременте не менялся | Отдельная test DB и повтор database tests |
| Backend API | `API_*`, acceptance `API-*`, development plan | CRUD foundation и sports API работают | Integration/E2E CRUD, OpenAPI snapshot, Bruno |
| Admin API | delivery plan, `ADMIN_API_BLUEPRINT`, acceptance `ADM-*` | Отдельный namespace и policy отсутствуют | Auth decision, projections, audit/concurrency |
| Backend audit | database audit, testing strategy, quality gates | Выполнен runtime/strict/build smoke | Полный endpoint/security/performance audit |
| Новости, страницы, контент | stage 2, `CONTENT_MODEL_SPEC` | Не реализовано | Locale и publication decisions |
| Медиа | stage 2, file acceptance `FIL-*` | DB foundation есть, upload API отсутствует | Storage, MIME/size/scan policy |
| SEO | public delivery requirements | Не реализовано | Content routes, canonical/hreflang/sitemap |
| Public API | stage 1, acceptance `PUB-*` | Sports admin-like routes есть; public projection отсутствует | Public allowlists и published-only tests |
| Админ-панель / Public Website | frontend plan | Не входят в текущий backend-инкремент | Только после стабильных contracts |
| Поиск | stage 6 backend order, public acceptance | Не реализовано | Locale/search vocabulary и indexes review |
| Переводы | stage 0/2 | Решения RU/RO и fallback требуют фиксации | Translation schema/contract |
| Навигация | stage 2 | Не реализовано | Content model + locale |
| Импорт/экспорт | stage 7, acceptance `INT-*` | DB import foundation есть, API/worker отсутствуют | Source inventory, dry-run contract |
| Integration API | stage 7 | Не реализовано | Auth/key and test-mode policy |
| Webhooks | stage 7 | Не реализовано | Signing, retries, idempotency |
| Background Jobs | stage 7 | Не реализовано | Queue/storage/worker decision |
| Авторизация, права, 2FA | stage 3, acceptance `SEC-*`/`ADM-*` | Не реализовано; API нельзя публиковать | Security architecture decision |
| Аудит | DB AuditLog есть | HTTP/domain audit workflow отсутствует | Actor/request/correlation policy |
| Мониторинг | stage 9 | Pino/health есть, metrics/alerts отсутствуют | Observability SLO and tooling |
| Rate Limiting | stage 3/9 | Не реализовано | Separate Public/Admin/Integration limits |
| Correlation ID | API architecture/testing | HTTP request ID работает | Audit/jobs/integration propagation |

Официальная ranking formula и регистрация на турниры сознательно не входят в
scope. Неизвестные решения остаются в `OPEN_QUESTIONS.md`.

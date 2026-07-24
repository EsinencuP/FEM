# Graphify installation report

Дата установки: 2026-07-23

Последнее обновление графа: 2026-07-24

Репозиторий: `C:\Users\User.DESKTOP\Documents\Web\FEM`

Итоговый статус: **READY WITH LIMITATIONS**

## 1. Окружение и установка

| Компонент  | Результат                                                    |
| ---------- | ------------------------------------------------------------ |
| ОС         | Windows 11, build 26100                                      |
| Shell      | Windows PowerShell 5.1                                       |
| Python     | 3.12.10                                                      |
| uv         | 0.11.30                                                      |
| Graphify   | 0.9.25                                                       |
| Пакет      | официальный PyPI `graphifyy`                                 |
| Способ     | `uv tool install graphifyy`                                  |
| SQL parser | официальный extra `graphifyy[sql]`, `tree-sitter-sql 0.3.11` |

`codex.exe` найден в пакете Codex Desktop, но прямой `codex --version` в этом
PowerShell возвращает Windows `Access is denied`. Это не блокирует установленный
project skill в текущем Codex Desktop.

## 2. Project skill

Команда:

```powershell
graphify install --project --platform codex
```

Фактический путь текущей версии:

```text
.codex/skills/graphify/SKILL.md
```

Созданы также:

- `.codex/skills/graphify/.graphify_version`;
- `.codex/skills/graphify/references/add-watch.md`;
- `.codex/skills/graphify/references/exports.md`;
- `.codex/skills/graphify/references/extraction-spec.md`;
- `.codex/skills/graphify/references/github-and-merge.md`;
- `.codex/skills/graphify/references/hooks.md`;
- `.codex/skills/graphify/references/query.md`;
- `.codex/skills/graphify/references/transcribe.md`;
- `.codex/skills/graphify/references/update.md`;
- `.codex/hooks.json`;
- секция `Graphify workflow` в `AGENTS.md`.

Ожидаемый заданием `.agents/skills/graphify/` не создавался: Graphify 0.9.25
использует `.codex/skills/graphify/` именно для платформы `codex`. Дублирование
skill в двух project-каталогах не выполнялось.

## 3. Безопасность и исключения

Перед сканированием проверены имена файлов и tracked-файлы на признаки:

- private keys;
- production database DSN;
- API keys, токены и пароли;
- сертификаты и credential-файлы.

Реальные секреты в tracked-файлах не обнаружены. Локальный `.env` игнорируется
Git и Graphify. Значения `.env` не читались и не выводились.

Graphify использует `.gitignore` и `.graphifyignore`. Исключены:

- `.env`, `.env.*`;
- `node_modules`, `dist`, `build`, `coverage`, `.next`;
- `graphify-out`, `tmp`, `temp`, `logs`;
- `*.log`, `*.dump`, `*.sql.gz`;
- ключи и контейнеры сертификатов.

Graphify sensitive detector безопасно пропустил `.env.example`, несмотря на
ignore-negation. В графе подтверждено ноль source paths из `.env`,
`node_modules` и `dist`.

Дополнительное сравнение без вывода значений подтвердило, что фактические
`POSTGRES_PASSWORD` и `DATABASE_URL` из локального `.env` отсутствуют в
`graph.json`, `GRAPH_REPORT.md` и `graph.html`.

## 4. Актуальный граф

Первый обычный вызов:

```powershell
graphify .
```

не отправлял документы и завершился до extraction, поскольку для 46 документов
не настроен LLM backend. Использован официальный локальный fallback:

```powershell
graphify extract . --code-only --force
graphify cluster-only .
```

Первый локальный graph был построен через code-only fallback. После обновления
backend и замены комплекта проектной документации выполнено полное безопасное
обновление:

```powershell
graphify update . --force
```

`--force` использован обоснованно: из corpus были удалены две дублирующие копии
документов, а Graphify без этого флага защищает существующий граф от
непреднамеренного уменьшения.

Актуальный результат:

| Метрика        | Значение |
| -------------- | -------: |
| Файлы corpus   |      264 |
| Примерно слов  |  211 932 |
| Узлы           |     2413 |
| Связи          |     5088 |
| Сообщества     |      160 |
| Inferred edges |       24 |
| Import cycles  |        0 |

Основные файлы:

- `graphify-out/graph.html`;
- `graphify-out/graph.json`;
- `graphify-out/GRAPH_REPORT.md`;
- `graphify-out/manifest.json`;
- локальный AST cache и резервные копии предыдущего построения.

`graph.json` успешно разобран как JSON. `GRAPH_REPORT.md` не пуст. `graph.html`
успешно отрендерен в headless Microsoft Edge с exit code 0.

`graph.json` успешно разобран как JSON. В актуальном графе отсутствуют удалённые
дубли `docs/FEM_MVP_ACCELERATED_PLAN.md` и
`docs/DOCS_REPLACEMENT_MAP.md`; канонические версии находятся в корне
репозитория. Новые документы DB-first demo распознаны как отдельные узлы.

Обновление выполнено без Gemini backend и с нулевой стоимостью LLM-токенов.
Код, SQL и явная структура Markdown проиндексированы, но глубокие семантические
связи документов остаются ограниченными. Ранее опубликованный в чате ключ не
использовался и не сохранялся; его следует отозвать и заменить.

## 5. Ключевые узлы и подсистемы

Основные god nodes актуального графа:

1. `dataResponse` — 101 связь;
2. `withSerializableTransaction()` — 99;
3. `PrismaService` — 77;
4. `AppConfigService` — 59;
5. `listResponse` — 41;
6. `paginationArgs()` — 41;
7. `AthletesService` — 41;
8. `Defect Register` — 41;
9. `HorsesService` — 40;
10. `AuthService` — 36.

Распознаны подсистемы:

- NestJS bootstrap, config и Pino logging;
- health check;
- единые response/error contracts;
- Zod validation;
- pagination и archive filters;
- `PrismaService` и database module;
- countries, disciplines, clubs, owners, athletes и horses;
- competitions, competition classes и competition results;
- Admin authentication, permissions, sessions и rate limiting;
- существующий Public API и publication workflow;
- external identifiers;
- seed, Jest tests и TypeScript/tooling configuration;
- 17 SQL migrations после подключения официального SQL extra;
- архитектурные, database и delivery Markdown-документы как структурные узлы.

`PrismaService` является естественным центральным database gateway, а
`DataResponse`/`ListResponse` — естественным API contract hub. Они не признаны
ошибочными god nodes автоматически.

## 6. Архитектурные наблюдения

- `AthletesController` и `AthletesService` — главный прикладной hotspot:
  спортсмены, клубные memberships, связи с лошадьми, identifiers и результаты
  сходятся в одном vertical slice.
- `ApiStandardErrors` связывает все реализованные CRUD controllers с общей
  моделью ошибки. Изменение error contract имеет широкое влияние.
- `paginationArgs()` и `archivedAtFilter()` являются общими точками поведения
  списков и архивирования.
- Import cycles не обнаружены.
- Три `INFERRED` связи относятся к bootstrap и Swagger/error decorators; перед
  изменениями их нужно подтверждать в коде.
- Центральность `compilerOptions` и package `scripts` является артефактом
  индексирования конфигурации, а не признаком доменной связанности.

Граф подтверждает, что первоначальный разрыв между Prisma schema и API закрыт:
Horse, CompetitionEvent, CompetitionClass, CompetitionResult и ResultMetric
представлены соответствующими vertical slices. Активный план первого demo
использует защищённый Admin API; уже существующий Public API сохраняется и
регрессионно проверяется, но не расширяется в рамках DB-first demo.

После Этапов 4–7 граф также распознал `apps/demo-web`: `apiRequest()` имеет 20
связей и является ожидаемым consumer hotspot для auth, lookups и шести
resource pages. EXTRACTED imports подтверждают единый API client. Автоматический
path от `CompetitionDetailPage` до backend controller прошёл через
`INFERRED` generic error/transaction nodes, поэтому этот путь не использовался
как доказательство runtime-вызова; фактические `/admin/*` paths подтверждены
чтением source и browser network/runtime QA.

`withSerializableTransaction()` является новым cross-community hotspot. Это
ожидаемо для защиты конкурентных операций, но любые изменения transaction
helper требуют повторной проверки athlete, horse, competition и result flows.

Документационные связи нельзя оценить полностью: Markdown вошёл как
структурный, но не как LLM-semantic layer. Нельзя делать вывод, что API не
документирован, только по отсутствию edge в этом графе.

## 7. CLI-проверки

| Команда                                   | Результат                                                     |
| ----------------------------------------- | ------------------------------------------------------------- |
| `graphify explain "PrismaService"`        | успешно; актуальный god node с 77 связями                     |
| `graphify explain "CompetitionResult"`    | успешно; SQL и API-представление распознаны                   |
| query про Admin API DB-first demo         | успешно; найдены controllers, services и delivery-документы   |
| query про archive/restore                 | успешно после vocabulary expansion                            |
| query про validation errors               | успешно: Zod pipe и exception filter найдены                  |
| path CompetitionEvent → CompetitionResult | найден; одноимённые schema/doc nodes требуют проверки в коде  |
| path Athlete → CompetitionResult          | найден; runtime flow подтверждается service и Prisma relation |
| path Horse → CompetitionResult            | найден; runtime flow подтверждается service и Prisma relation |

`explain CompetitionResult` отдельно подтвердил SQL references к Athlete,
Horse, CompetitionClass, ResultStatus, Document и User. Автоматический `path`
после добавления документов выбрал одноимённые document nodes; этот путь не
следует трактовать как runtime call flow.

## 8. Git-стратегия

В Git рекомендуется добавить project skill, hook config, `AGENTS.md`,
`.graphifyignore` и документацию. `graphify-out/` занимает около 2.2 MB только
на верхнем уровне без
cache/backups, имеет нестабильные generated diff и уже добавлен в `.gitignore`.

Рекомендуемый вариант: **A — не хранить generated graph в Git и перестраивать
локально**.

## 9. Проверки backend

Полный подтверждённый gate перед заменой документов выполнялся в Node.js
`22.23.1`:

| Проверка                | Результат                              |
| ----------------------- | -------------------------------------- |
| Prisma format/validate  | PASS                                   |
| Prisma generate         | PASS                                   |
| `pnpm lint`             | PASS                                   |
| `pnpm typecheck`        | PASS                                   |
| `pnpm test`             | PASS: 10 suites, 70 tests              |
| database tests          | PASS: 2 suites, 28 tests               |
| `pnpm test:e2e`         | PASS: 12 suites, 85 tests              |
| `pnpm build`            | PASS                                   |
| OpenAPI snapshot/check  | PASS: 125 operations                   |
| restricted runtime role | PASS: health/public/admin/docs policy  |
| demo-web gate           | PASS: lint, strict TS, 11 tests, build |

После текущего документационного обновления минимальный gate
`lint/typecheck/test/build` запускается повторно; его фактический результат
фиксируется в `docs/delivery/CURRENT_QUALITY_STATUS.md` и
`docs/progress/CHANGELOG_AI.md`.

## 10. Ограничения и статус

- Markdown-документы структурно индексированы, но не семантизированы LLM.
- `schema.prisma` и Docker YAML не являются полноценными AST-узлами.
- Три JSON-конфига не дали узлов.
- Community labels остались техническими hub-именами без LLM labeling.
- Прямой `codex --version` заблокирован Windows ACL текущего desktop package.
- Graphify не заменяет чтение кода, SQL-аудит или выполнение тестов.

Graphify установлен, project-scoped skill работает, локальная карта кода и SQL
migrations построена, результаты безопасно исключены из Git. Итог:
**READY WITH LIMITATIONS**.

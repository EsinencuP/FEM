# Graphify installation report

Дата: 2026-07-23  
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

## 4. Первый граф

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

Результат:

| Метрика                      | Значение |
| ---------------------------- | -------: |
| Файлы в итоговом corpus      |      105 |
| Code files                   |       60 |
| Markdown files               |       45 |
| Узлы                         |     1093 |
| Связи                        |     1610 |
| Сообщества                   |       64 |
| Inferred edges               |        3 |
| Import cycles                |        0 |
| Isolated/weak nodes в отчёте |      559 |

Основные файлы:

- `graphify-out/graph.html`;
- `graphify-out/graph.json`;
- `graphify-out/GRAPH_REPORT.md`;
- `graphify-out/manifest.json`;
- локальный AST cache и резервные копии предыдущего построения.

`graph.json` успешно разобран как JSON. `GRAPH_REPORT.md` не пуст. `graph.html`
успешно отрендерен в headless Microsoft Edge с exit code 0.

После начального code-only build официальная команда `graphify update .`
добавила структурные Markdown-узлы без LLM и обновила итог до 1093 узлов. Это
не равно семантическому извлечению: связи документов основаны на структуре и
явных упоминаниях.

## 5. Ключевые узлы и подсистемы

Основные god nodes итогового графа:

1. `dataResponse` — 39 связей;
2. `PrismaService` — 29;
3. `compilerOptions` — 29;
4. `Frontend Anti-patterns` — 23;
5. `AthletesController` — 22;
6. `AthletesService` — 22;
7. package `scripts` — 21;
8. `Ranking Engine Boundaries` — 16;
9. `AppConfigService` — 15;
10. `ClubsController` — 15.

Распознаны подсистемы:

- NestJS bootstrap, config и Pino logging;
- health check;
- единые response/error contracts;
- Zod validation;
- pagination и archive filters;
- `PrismaService` и database module;
- countries, disciplines, clubs, owners, athletes;
- external identifiers;
- seed, Jest tests и TypeScript/tooling configuration;
- обе SQL migrations после подключения официального SQL extra.
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

В Prisma migrations представлены Horse, CompetitionEvent, CompetitionClass,
CompetitionResult, ResultMetric, ranking и системные таблицы, но в `src/modules`
сейчас есть только:

- athletes;
- clubs;
- countries;
- disciplines;
- external-identifiers;
- owners.

Следовательно, база существенно шире текущего API. Horse и competition/result
vertical slices являются основными пробелами следующего backend-аудита.

Документационные связи нельзя оценить полностью: Markdown вошёл как
структурный, но не как LLM-semantic layer. Нельзя делать вывод, что API не
документирован, только по отсутствию edge в этом графе.

## 7. CLI-проверки

| Команда                                   | Результат                                                        |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `graphify explain "PrismaService"`        | успешно, 29 связей                                               |
| `graphify explain "CompetitionResult"`    | успешно после SQL extra, 9 связей                                |
| query про athlete/horse results           | частично: найден Athlete API; competition/result API отсутствует |
| query про archive/restore                 | успешно после vocabulary expansion                               |
| query про validation errors               | успешно: Zod pipe и exception filter найдены                     |
| path CompetitionEvent → CompetitionResult | 2 hops через document container; ambiguous-match warning         |
| path Athlete → CompetitionResult          | 4 hops через DATA_DICTIONARY; ambiguous-match warning            |
| path Horse → CompetitionResult            | 4 hops через DATA_DICTIONARY; ambiguous-match warning            |

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

Проверки выполнялись в Node.js `22.23.1` и pnpm `11.9.0`.

| Проверка         | Результат                                                     |
| ---------------- | ------------------------------------------------------------- |
| `pnpm lint`      | FAIL: 109 ошибок в существующих незавершённых CRUD-заготовках |
| `pnpm typecheck` | FAIL: 6 TypeScript errors                                     |
| `pnpm test`      | PASS: 3 suites, 6 tests                                       |
| `pnpm build`     | FAIL: те же strict TypeScript errors                          |

Основные существующие причины: отсутствующий прямой тип `express`, Prisma where
objects с optional `undefined` при `exactOptionalPropertyTypes`, отсутствующие
explicit return types. Они присутствовали в рабочем дереве до установки
Graphify и не исправлялись в этой задаче.

## 10. Ограничения и статус

- Markdown-документы структурно индексированы, но не семантизированы LLM.
- `schema.prisma` и Docker YAML не являются полноценными AST-узлами.
- Три JSON-конфига не дали узлов.
- Community labels остались техническими hub-именами без LLM labeling.
- Прямой `codex --version` заблокирован Windows ACL текущего desktop package.
- Backend quality gate уже был красным до Graphify и остаётся красным.

Graphify установлен, project-scoped skill работает, локальная карта кода и SQL
migrations построена, результаты безопасно исключены из Git. Итог:
**READY WITH LIMITATIONS**.

# Graphify workflow

Дата: 2026-07-23  
Graphify: `0.9.25`

## Назначение

Graphify создаёт локальную карту кода и зависимостей FEM. Карта помогает
находить архитектурные центры, связи между контроллерами, сервисами, DTO,
Prisma-слоем, миграциями и тестами до широкого поиска по репозиторию.

Graphify является навигационным инструментом, а не источником абсолютной истины.
Любой вывод из графа подтверждается чтением актуального исходного кода.

## Требования и установка

- Windows 11 и PowerShell;
- Python 3.10 или новее; в проекте проверен Python `3.12.10`;
- `uv`; в проекте проверен `uv 0.11.30`;
- Graphify устанавливается из официального PyPI-пакета `graphifyy`.

```powershell
winget install --id Python.Python.3.12 -e
winget install --id astral-sh.uv -e
uv tool update-shell
uv tool install graphifyy
uv tool install --upgrade "graphifyy[sql]"
graphify --version
```

SQL extra нужен для разбора локальных Prisma migration SQL. Он входит в
официальный пакет Graphify.

## Project-scoped skill для Codex

Из корня репозитория:

```powershell
graphify install --project --platform codex
```

Graphify 0.9.25 создаёт:

- `.codex/skills/graphify/SKILL.md`;
- `.codex/skills/graphify/references/`;
- `.codex/hooks.json`;
- секцию `Graphify workflow` в `AGENTS.md`.

Путь `.agents/skills/graphify/` относится к другим платформам Graphify. Для
платформы `codex` текущая версия использует `.codex/skills/graphify/`.

## Первое построение

Полный запуск с семантическим анализом документов:

```powershell
graphify .
```

Он требует явно настроенный поддерживаемый LLM backend, если в корпусе есть
Markdown, PDF или изображения. Ключи нельзя добавлять только ради сканирования.

Без внешнего семантического backend используется полностью локальный code-only
режим:

```powershell
graphify extract . --code-only --force
graphify cluster-only .
```

Результаты:

- `graphify-out/graph.html` — интерактивная карта;
- `graphify-out/GRAPH_REPORT.md` — архитектурный отчёт;
- `graphify-out/graph.json` — машинно читаемый граф;
- `graphify-out/manifest.json` — состояние для обновлений.

## Запросы

```powershell
graphify explain "PrismaService"
graphify query "How are validation errors transformed into API responses?"
graphify path "Athlete" "CompetitionResult"
graphify god-nodes --top 15
```

`query` использует буквальное совпадение слов. При слабом результате нужно
выбрать термины, которые реально встречаются в labels графа, и повторить запрос.
`EXTRACTED` означает связь, извлечённую из кода. `INFERRED` является гипотезой и
всегда требует проверки в исходнике.

## Обновление

Официальная инкрементальная команда Graphify 0.9.25:

```powershell
graphify update .
```

Она подходит для обычных изменений кода. Если изменились документы, а
семантический backend не настроен, обновление документов останется
ограниченным. Безопасный локальный fallback — повторное code-only построение.

Полное перестроение обязательно после:

- существенного изменения структуры;
- изменения Prisma schema или migration SQL;
- массового перемещения или переименования файлов;
- подозрения на повреждённый cache;
- обновления Graphify.

```powershell
graphify extract . --code-only --force
graphify cluster-only .
```

## Исключения и безопасность

Graphify 0.9.25 объединяет правила `.gitignore` и `.graphifyignore`.
Исключены:

- `.env` и `.env.*`;
- `node_modules`, `dist`, `build`, `coverage`, `.next`;
- `graphify-out`, `tmp`, `temp`, `logs`;
- логи, дампы, архивы SQL и приватные ключи.

`.env.example` разрешён ignore-правилом, но текущий sensitive-file detector
Graphify всё равно пропускает его по имени. Нельзя ослаблять защиту копированием
секретов в файл с другим именем.

Перед семантической обработкой документов нужно отдельно подтвердить отсутствие
паролей, API keys, токенов, production DSN, приватных ключей и сертификатов.
Значения секретов нельзя выводить в отчёт или терминал.

## Рабочий процесс большой задачи

1. Открыть проект из корня репозитория.
2. Убедиться, что граф актуален.
3. Прочитать `graphify-out/GRAPH_REPORT.md`.
4. Выполнить `query` по задаче.
5. Выполнить `path` для критических зависимостей.
6. Открыть только релевантные исходные файлы и проверить выводы графа.
7. Внести изменения.
8. Запустить lint, typecheck, tests и build.
9. Обновить граф.
10. Проверить новые god nodes, cycles и неожиданные связи.

## Git-стратегия

В Git рекомендуется хранить:

- `.codex/skills/graphify/`;
- `.codex/hooks.json`;
- `.graphifyignore`;
- `AGENTS.md`;
- этот документ и installation report.

`graphify-out/` генерируется локально, содержит нестабильные большие diff и
локальные служебные метаданные, поэтому по умолчанию находится в `.gitignore`.
Команда может позднее осознанно выбрать хранение только `GRAPH_REPORT.md`, но не
должна добавлять весь каталог автоматически.

## Ограничения

- Code-only карта не индексирует Markdown-содержание.
- `schema.prisma` и Docker YAML не представлены как полноценные AST-узлы.
- SQL migration parser отражает таблицы и references, но не заменяет Prisma
  schema audit.
- Автоматическая кластеризация может группировать технические конфиги рядом с
  прикладными узлами.
- Устаревший граф не является доказательством актуального поведения системы.

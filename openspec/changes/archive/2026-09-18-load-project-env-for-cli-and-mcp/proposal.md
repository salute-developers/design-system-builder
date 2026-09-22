## Why

CLI видит переменные из интерактивной оболочки, а локальный MCP server, запущенный Codex как отдельный процесс, может их не наследовать. Из-за этого `.sdds/config.json` правильно выбирает дизайн-систему и имя project API key, но MCP не находит значение ключа. Локальный `.env` в корне проекта даст обоим клиентам предсказуемый дополнительный источник конфигурации без записи секрета в `.sdds` или настройки Codex.

## What Changes

- CLI и оба MCP launcher (`dsbuilder mcp serve`, `dsbuilder-mcp serve`) читают `<project-root>/.env`, где `<project-root>` — директория найденного `.sdds/config.json`.
- Значения CLI-аргументов сохраняют высший приоритет; для каждого имени переменной env процесса имеет приоритет над проектным `.env`. Отсутствующий `.env` не меняет текущее поведение.
- Project API key разрешается по имени из `credential.name` через общий credential flow; `DSBUILDER_API_URL` получает тот же проектный fallback. Existing credential policies и fallback на user session сохраняются.
- Секреты не записываются в `.sdds/config.json`, не возвращаются MCP tools и не выводятся в диагностику. Локальный `.env` остаётся вне Git.

## Capabilities

### New Capabilities

- `project-local-environment`: выбор и чтение локального `.env` для общего runtime CLI и MCP, включая приоритеты, границу проекта и обработку ошибок.

### Modified Capabilities

- `cli-core`: credential и API URL resolution получают проектный `.env` как fallback после env процесса.
- `frontend-mcp-server`: оба MCP launcher используют проектный `.env` найденного workspace для backend credentials и API URL.
- `cli-components`: `components push` разрешает локальный context перед проверкой явно настроенного backend API URL, включая URL из проектного `.env`.

## Impact

- `frontend-kt`: общий runtime, `core-workspace`/`core-application`/`core-auth`/`core-network` по фактической границе реализации, `:cli`, `:mcp-node`, MCP contract и документация.
- `backend-kt` и `js`: API, схема, persistence и сервисы не меняются. Новых сетевых endpoint нет.
- Конфигурация: необязательный `<project-root>/.env`; существующий `.gitignore` уже исключает `.env`. Может потребоваться библиотека парсинга либо небольшой общий parser, совместимый с JVM, macOS и Node.js.

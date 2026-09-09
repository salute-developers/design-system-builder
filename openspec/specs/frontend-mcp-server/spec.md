# frontend-mcp-server Specification

## Purpose
TBD - created by archiving change add-frontend-mcp-server. Update Purpose after archive.
## Requirements
### Requirement: Общий Kotlin Multiplatform MCP server

`frontend-kt` SHALL содержать `:mcp-server-core`, использующий
`io.modelcontextprotocol:kotlin-sdk-server:0.10.0` и общий прикладной слой без зависимости `core-*`/`feature-*` от MCP
SDK types.

#### Scenario: MCP SDK изолирован presentation-слоем

- **WHEN** разработчик инспектирует импорты `core-*` и `feature-*`
- **THEN** эти модули MUST NOT импортировать `io.modelcontextprotocol.*`
- **THEN** mapping между MCP DTO и use-case command/result MUST находиться в `:mcp-server-core`

#### Scenario: MCP dependency graph компилируется для всех launcher

- **WHEN** Gradle компилирует `:mcp-server-core`
- **THEN** compilation MUST быть успешной для JVM, Node.js JS, macOS arm64 и macOS x64 с выбранной Kotlin toolchain

### Requirement: Два независимых launcher

Один MCP server SHALL запускаться отдельным Node.js executable `dsbuilder-mcp serve` и in-process CLI-командой
`dsbuilder mcp serve`.

#### Scenario: Node launcher запускается отдельно

- **WHEN** пользователь устанавливает npm package MCP без основного CLI
- **THEN** executable `dsbuilder-mcp serve` MUST запускать `:mcp-server-core`
- **THEN** executable MUST NOT требовать установленный `dsbuilder`

#### Scenario: CLI launcher не запускает Node subprocess

- **WHEN** пользователь запускает `dsbuilder mcp serve`
- **THEN** CLI MUST запустить `:mcp-server-core` внутри JVM/macOS процесса
- **THEN** CLI MUST NOT требовать Node.js или запускать `dsbuilder-mcp` как subprocess

#### Scenario: Launcher используют одинаковую runtime-конфигурацию

- **WHEN** любой launcher получает `--api-url` или `--workspace`
- **THEN** он MUST передать значения в общий server config
- **THEN** оба launcher MUST использовать общий `ApiUrlResolver`, `ContextResolver` и `CredentialProvider`

### Requirement: Локальный stdio transport

MCP MVP SHALL работать только как локальный stdio server и SHALL NOT открывать HTTP port.

#### Scenario: Stdout зарезервирован протоколом

- **WHEN** MCP server работает
- **THEN** stdout MUST содержать только MCP protocol messages
- **THEN** process logs и диагностика launcher MUST направляться в stderr
- **THEN** raw credentials MUST NOT выводиться ни в stdout, ни в stderr

#### Scenario: Server корректно завершает lifecycle

- **WHEN** stdin закрывается или процесс получает `SIGINT`/`SIGTERM`
- **THEN** server MUST закрыть MCP session, HTTP client и файловые ресурсы
- **THEN** штатное EOF stdin MUST завершить процесс с exit code `0`

#### Scenario: Credentials отсутствуют при запуске

- **WHEN** server запускается без project key и user session
- **THEN** server MUST успешно ответить на `initialize` и `tools/list`
- **THEN** backend-dependent `tools/call` MUST вернуть структурированный `AUTH_REQUIRED`, не завершая server

### Requirement: Общий context resolution

MCP server SHALL получать project/design-system context только через общий `ContextResolver`, используемый CLI.

#### Scenario: Ближайшая project config разрешается общим source

- **WHEN** starting directory находится внутри дерева с родительской `.sdds/config.json`
- **THEN** MCP MUST получить context через тот же nearest-config `ContextSource`, что и CLI
- **THEN** MCP MUST NOT реализовывать отдельный поиск `.sdds`

#### Scenario: Явный workspace задает starting directory

- **WHEN** launcher получает `--workspace`
- **THEN** значение MUST только заменить starting directory общего resolver
- **THEN** приоритеты и доступные `ContextSource` MUST остаться одинаковыми для CLI и MCP

### Requirement: Начальный набор MCP tools

Первая версия MCP server SHALL предоставлять `design_system_get_context` и `project_get_status` через общие application
use cases/ports.

#### Scenario: design_system_get_context не раскрывает credential

- **WHEN** MCP client вызывает `design_system_get_context`
- **THEN** tool MUST вернуть resolved project/design-system context и API URL
- **THEN** tool MAY вернуть тип credential
- **THEN** tool MUST NOT вернуть project key, access token, refresh token или password

#### Scenario: project_get_status проверяет backend

- **WHEN** MCP client вызывает `project_get_status` с разрешенным context и credential
- **THEN** tool MUST вызвать общий status use case
- **THEN** tool MUST вернуть структурированный status без парсинга CLI output

### Requirement: Стабильные MCP results и ошибки

MCP presentation SHALL отделять protocol errors от предметных tool errors и SHALL возвращать стабильные JSON-compatible
DTO независимо от CLI presentation.

#### Scenario: Предметная ошибка возвращается как tool result

- **WHEN** application возвращает `AUTH_REQUIRED`, `PROJECT_KEY_INVALID`, `FORBIDDEN`, `CONTEXT_NOT_FOUND` или
  `BACKEND_UNAVAILABLE`
- **THEN** handler MUST вернуть `CallToolResult` с `isError=true`
- **THEN** result MUST содержать стабильные `code`, `message` и optional `details`
- **THEN** result MUST NOT содержать stack trace или raw secret

#### Scenario: Невалидный protocol request

- **WHEN** MCP client вызывает неизвестный tool или передает аргументы, не соответствующие input schema
- **THEN** server MUST вернуть MCP/JSON-RPC protocol error
- **THEN** request MUST NOT достигнуть application use case

### Requirement: Backend authorization остается серверной ответственностью

MCP server SHALL передавать выбранный credential в DS Builder API и SHALL NOT вычислять локальные роли или scopes.

#### Scenario: Backend запрещает операцию

- **WHEN** DS Builder API возвращает `403`
- **THEN** MCP MUST вернуть `FORBIDDEN`
- **THEN** MCP MUST NOT скрывать или повторно разрешать операцию на основании локально вычисленной роли

#### Scenario: Локальный файл обрабатывается безопасно

- **WHEN** будущий tool изменяет локальный workspace
- **THEN** пути MUST оставаться внутри разрешенной рабочей директории
- **THEN** защита пути MUST считаться filesystem boundary, а не заменой backend RBAC

### Requirement: Отдельная npm-поставка

`:mcp-node` SHALL собирать устанавливаемый npm package с executable `dsbuilder-mcp`.

#### Scenario: Упакованный executable запускается вне Gradle build directory

- **WHEN** CI выполняет `npm pack`, устанавливает полученный tarball во временную директорию и запускает его bin
- **THEN** `dsbuilder-mcp --help`, `dsbuilder-mcp auth --help` и `dsbuilder-mcp serve` MUST запускаться без Gradle
- **THEN** package MUST содержать shebang launcher, Kotlin/JS distribution, README и license


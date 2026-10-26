# frontend-mcp-server Specification

## Purpose
Общий Kotlin Multiplatform MCP-сервер с отдельными средствами запуска, локальным транспортом stdio и разрешением контекста проекта.

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

Первый этап расширения MCP SHALL предоставлять ровно 22 инструмента чтения согласно design.md Change add-versioned-read-tools, сохраняя оба launcher и общий прикладной слой.

#### Scenario: design_system_get_context не раскрывает credential

- **WHEN** клиент вызывает `design_system_get_context`
- **THEN** tool MUST вернуть разрешённый контекст проекта/DS, API URL и фактическую версию из метаданных серверного чтения
- **THEN** tool SHALL сохранять безопасный тип credential при его наличии
- **THEN** tool MUST NOT вернуть ключ проекта, access token, refresh token или пароль

#### Scenario: project_get_status проверяет backend

- **WHEN** клиент вызывает `project_get_status` с разрешенным context и credential
- **THEN** tool MUST вызвать общий сценарий status
- **THEN** tool MUST вернуть структурированный status без разбора вывода CLI

#### Scenario: Реестр первого этапа

- **WHEN** клиент вызывает tools/list после первого этапа
- **THEN** он MUST получить design_system_get_context, project_get_status, design_system_versions_list, design_system_version_get, design_system_changes_list, tenants_list, tokens_list, token_get, token_values_get, token_groups_list, palette_get, components_list, component_get, component_styles_get, component_variations_get, component_config_get, documentation_search, documentation_fetch, documentation_get_navigation, documentation_get_page, code_binding_search и code_binding_get
- **THEN** все инструменты MUST оставаться read-only и доступными для обнаружения без credentials

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

### Requirement: Headless MCP context per call

MCP server SHALL запускаться без `.sdds` и `--workspace`, а project-scoped tools SHALL принимать optional `designSystem` URI и разрешать контекст независимо для каждого вызова.

#### Scenario: Headless startup

- **WHEN** MCP server запущен без workspace и без credential
- **THEN** `initialize` и `tools/list` MUST завершиться успешно
- **THEN** project-scoped tool без ссылки MUST вернуть структурированный `CONTEXT_REQUIRED`

#### Scenario: Два чата используют один server

- **WHEN** параллельные вызовы передают ссылки на разные дизайн-системы
- **THEN** каждый вызов MUST использовать только свой resolved context
- **THEN** один вызов MUST NOT менять контекст другого или последующих вызовов

#### Scenario: Агент передаёт ссылку из чата

- **WHEN** MCP client вызывает project-scoped tool с `designSystem` URI
- **THEN** tool MUST передать URI общему context resolver
- **THEN** ответ MUST содержать фактически использованный контекст или явную ошибку его разрешения

### Requirement: MCP контекст и credential не смешиваются

MCP presentation SHALL описывать `designSystem` как выбор ресурса, а авторизацию — как отдельную runtime policy; URI MUST NOT интерпретироваться как API URL или credential.

#### Scenario: Проекция конфигурации компонента использует один runtime

- **WHEN** `component_config_get` запрашивает `token-references` для локального контекста
- **THEN** прикладной сценарий MUST разрешить runtime один раз и использовать его для чтения конфигурации и каталога токенов
- **THEN** MCP MUST передать параметры сценария и сериализовать результат без собственной оркестрации двух чтений

#### Scenario: Неверная ссылка

- **WHEN** tool получает некорректный `designSystem` URI
- **THEN** он MUST вернуть `INVALID_CONTEXT`
- **THEN** он MUST NOT переключаться на локальную `.sdds` или другой actor

### Requirement: MCP documentation read tools
MCP server SHALL expose read-only documentation tools that use the shared frontend application layer and return structured documentation DTOs.

#### Scenario: Documentation search returns structured results
- **WHEN** MCP client calls `documentation_search` with `query`, resolved project context, design system, version and platform
- **THEN** MCP server MUST call the shared documentation search use case
- **THEN** MCP server MUST return deterministic JSON-compatible results with markdown hits, code-binding hits, snippets, subjects, `kbUrl` values and optional `nextCursor`
- **THEN** MCP server MUST NOT require the client to call shell commands or parse CLI output

#### Scenario: Documentation read requires an exact version selection
- **WHEN** a documentation or code-binding read tool omits `version` and the resolved design-system context does not select one
- **THEN** MCP server MUST return `AMBIGUOUS_CONTEXT` before calling the documentation backend
- **THEN** MCP server MUST NOT substitute a synthetic version such as `0.0.0`

#### Scenario: Documentation fetch reads knowledge chunk
- **WHEN** MCP client calls `documentation_fetch` with a `kbUrl` returned by `documentation_search`
- **THEN** MCP server MUST call the shared documentation fetch use case
- **THEN** MCP server MUST return the published `markdown` with source metadata or a structured `NOT_FOUND` error
- **THEN** MCP server MUST omit the derived `searchText` search-index copy from the model-visible response

#### Scenario: Documentation navigation and pages read active publication
- **WHEN** MCP client calls `documentation_get_navigation` or `documentation_get_page`
- **THEN** MCP server MUST resolve the active publication for the requested or context-selected version and platform
- **THEN** MCP server MUST return navigation or page DTOs from the documentation service
- **THEN** MCP server MUST return `PUBLICATION_NOT_FOUND` when no active publication exists

### Requirement: MCP code binding read tools
MCP server SHALL expose read-only code binding tools for locating and reading references from published documentation artifacts.

#### Scenario: Code binding search filters by subject and kind
- **WHEN** MCP client calls `code_binding_search` with `subject` and optional `kind`, `name`, `limit` or `cursor`
- **THEN** MCP server MUST call the shared code binding search use case
- **THEN** MCP server MUST return binding IDs, canonical subjects, kinds, names, platforms and pagination metadata

#### Scenario: Code binding get resolves an exact reference
- **WHEN** MCP client calls `code_binding_get` with a `bindingId`
- **THEN** MCP server MUST resolve that exact published binding before applying any model-visible projection
- **THEN** MCP server MUST return `NOT_FOUND` when the binding is absent or outside the authorized project

#### Scenario: Component binding get returns bounded response detail
- **WHEN** MCP client calls `code_binding_get` without `detail` or `variationNames`
- **THEN** MCP server MUST return a compact component binding summary containing appearance names, variation axes, defaults and counts
- **THEN** MCP server MUST omit expanded variations and style API metadata from the summary
- **WHEN** MCP client calls `code_binding_get` with `detail=variations` or exact `variationNames`
- **THEN** MCP server MUST return concrete variation code references while omitting style API metadata
- **WHEN** MCP client calls `code_binding_get` with `detail=full`
- **THEN** MCP server MUST preserve the complete published binding payload after applying optional name filters

#### Scenario: Tool descriptions route published code variation queries
- **WHEN** an MCP client inspects tool descriptions to answer which published code variations are available
- **THEN** `code_binding_search` MUST direct the client to continue with `code_binding_get` using `detail=summary`
- **THEN** `components_list` and `component_variations_get` MUST identify their results as configuration-model data and direct published code variation queries to the code binding tools

#### Scenario: Component binding get filters opaque appearance and variation names
- **WHEN** MCP client calls `code_binding_get` with optional `appearanceNames` or `variationNames`
- **THEN** MCP server MUST fetch the unchanged published binding from the backend
- **THEN** MCP server MUST filter `platformPayload.styles` by exact `styleName` values from `appearanceNames`
- **THEN** MCP server MUST filter each retained appearance's `variations` by exact `name` values from `variationNames`
- **THEN** MCP server MUST NOT interpret appearance or variation names as fixed semantic axes

#### Scenario: Code bindings are not authoritative system model
- **WHEN** MCP client reads a token or component through `code_binding_get`
- **THEN** MCP server MUST identify the result as documentation/code-reference data
- **THEN** MCP server MUST NOT present code binding data as authoritative token or component configuration state

### Requirement: MCP token read tools

MCP SHALL читать авторитетные токены через API модели, передавать версии, фильтры и пагинацию серверу и преобразовывать HTTP-метаданные в структурированный результат.

#### Scenario: Token list reads system tokens

- **WHEN** tokens_list получает type, name либо query, groupId, limit, cursor и version
- **THEN** MCP MUST передать фильтры серверу, явно запросить limit по умолчанию 50 и вернуть items/nextCursor с ID, именами, типами, displayName и description
- **THEN** точный name и limit MUST NOT вычисляться локально после получения полного массива
- **THEN** name и query вместе MUST быть отклонены
- **THEN** список MUST NOT восстанавливаться из документации

#### Scenario: Token get reads one system token

- **WHEN** token_get получает tokenId и необязательный version
- **THEN** MCP MUST вернуть авторитетный DTO и фактический контекст из HTTP-метаданных, сохраняя доступные ссылки и ревизии

#### Scenario: Token values get reads resolved values

- **WHEN** token_values_get получает tokenId и необязательные tenantId, mode, platform и version
- **THEN** MCP MUST передать фильтры серверу и сохранить метаданные исходных, ссылочных и разрешённых значений, которые предоставляет API
- **THEN** отсутствие фильтров MUST NOT выбирать tenant/platform/mode неявно
- **THEN** platform MUST остаться web/android/ios

### Requirement: MCP component read tools
MCP SHALL читать мету компонента и версионированные данные конфигураций через соответствующие существующие API, передавая поддерживаемые версии и фильтры серверу. Схема component_config_get сохраняется до add-composite-read-tools.

#### Scenario: Component list reads system components
- **WHEN** клиент вызывает components_list с необязательными name, query, platform, limit, cursor или version
- **THEN** MCP MUST вызвать общий прикладной сценарий чтения модели
- **THEN** MCP MUST вернуть компактные данные с ID, именами и описаниями
- **THEN** точный `name` и `platform` MUST применяться сервером
- **THEN** name и query MUST NOT приниматься вместе
- **THEN** MCP MUST явно запросить серверный `limit` и читать продолжение из заголовка без локальной обрезки массива
- **THEN** при отсутствии `limit` MCP MUST передать 50; это не меняет полную выдачу HTTP без limit/cursor
- **THEN** MCP MUST NOT восстанавливать список из документации

#### Scenario: Component config get reads authoritative config

- **WHEN** клиент вызывает component_config_get с каноническим subject либо точным name и необязательным style
- **THEN** MCP MUST сохранить текущую каноническую конфигурацию, props, bindings, invariants, variations и доступные ревизии
- **THEN** этот этап MUST NOT объявлять componentId новым параметром прежнего экспорта или менять selection/projection до следующего Change

#### Scenario: Мета компонента без выбора конфигурации

- **WHEN** клиент вызывает component_get с componentId
- **THEN** MCP MUST вызвать GET /components/{id} и сохранить id, name, description, platform, createdAt и updatedAt
- **THEN** tool MUST NOT добавлять список конфигураций, выбирать appearance или объявлять ответ снимком одной DS
- **THEN** схема tool MUST NOT содержать version; версия URI/контекста MUST NOT передаваться как версия глобальной меты
- **THEN** отсутствие X-DS-Read-Context одной DS/публикации MUST NOT считаться ошибкой этого чтения

#### Scenario: Component styles and variations read model details

- **WHEN** клиент вызывает component_styles_get с componentId и необязательным version
- **THEN** MCP MUST использовать прежний маршрут оформлений DS и сохранить ID компонента и оформления
- **WHEN** component_variations_get получает appearanceId и необязательный version
- **THEN** MCP MUST читать оси указанной конфигурации через GET /appearances/{id}/variations и сохранять appearanceId и variationId

#### Scenario: Вариации конкретной конфигурации

- **WHEN** клиент вызывает component_variations_get с обязательным appearanceId и необязательным version
- **THEN** MCP MUST вызвать GET /appearances/{id}/variations и вернуть существующие оси, values и defaultStyleId без include=values,defaults и локальной сборки конфигурации
- **THEN** результат MUST сохранить id объявления оси, appearanceId, variationId, position, isRoot, isColorScheme, declaredType, даты и доступные поля значений
- **THEN** фактическая DS и версия MUST определяться сервером по appearance и передаваться в контексте чтения
- **THEN** MCP MUST NOT вызывать GET /components/{id}/variations или выбирать единственную/default-конфигурацию автоматически

#### Scenario: Аргументы и версия вариаций

- **WHEN** appearanceId отсутствует либо вместо него передан прежний componentId
- **THEN** MCP MUST вернуть INVALID_QUERY
- **WHEN** version задан явно
- **THEN** он MUST перекрыть версию URI/контекста; при отсутствии выбора MUST использоваться draft
- **THEN** NOT_FOUND неизвестной, недоступной или отсутствующей на выбранной границе конфигурации либо чужой версии MUST NOT превращаться в чтение draft

#### Scenario: Ограниченное чтение оформлений

- **WHEN** component_styles_get получает name, limit или cursor
- **THEN** MCP MUST передать их серверу и вернуть серверный nextCursor, используя limit=50 по умолчанию

### Requirement: MCP read tool safety and errors
Expanded read tools SHALL preserve the existing MCP security and diagnostics model.

#### Scenario: Read tools do not expose credentials
- **WHEN** any new MCP read tool returns success or failure
- **THEN** the response MUST NOT contain project keys, access tokens, refresh tokens, passwords or raw credential headers

#### Scenario: Backend and validation failures map to stable errors
- **WHEN** a new MCP read tool receives invalid input or backend returns an authorization, availability or not-found failure
- **THEN** MCP server MUST return a structured error with stable code `INVALID_ARGUMENT`, `INVALID_QUERY`, `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `PUBLICATION_NOT_FOUND`, `BACKEND_UNAVAILABLE` or `CONTEXT_NOT_FOUND`
- **THEN** MCP server MUST NOT include stack traces in the tool result body

#### Scenario: Expanded tools stay read-only
- **WHEN** MCP client lists available tools after this change
- **THEN** token and component tools MUST include only read operations
- **THEN** MCP server MUST NOT expose `token_create`, `token_update`, `token_delete`, `token_value_set`, `component_config_update` or other mutating token/component tools in this change

### Requirement: MCP использует env локального проекта

Оба MCP launcher SHALL использовать общий project-scoped env источник для локального context. Они SHALL сохранять тот же приоритет аргумента, env процесса и `.env` проекта, что и CLI, и SHALL разрешать credential отдельно для каждого вызова tool.

#### Scenario: Ключ найден в `.env` workspace

- **WHEN** MCP запущен с `--workspace /repo` и `/repo/.sdds/config.json` задаёт `credential.name = "DSB_DEV_API_KEY"`
- **WHEN** env процесса не содержит `DSB_DEV_API_KEY`, а `/repo/.env` содержит его
- **THEN** backend request MUST использовать `Authorization: ProjectKey <key>`
- **THEN** MCP result MUST NOT содержать значение key

#### Scenario: Env процесса перекрывает `.env`

- **WHEN** env процесса и проектный `.env` содержат `DSB_DEV_API_KEY`
- **THEN** MCP MUST использовать значение env процесса

#### Scenario: Явный designSystem не наследует локальный secret

- **WHEN** MCP tool получает явный `designSystem` URI
- **THEN** MCP MUST NOT читать project key или API URL из локального `.env` сервера
- **THEN** MCP MUST разрешить credential согласно существующей headless policy

#### Scenario: Нет ключа при auto policy

- **WHEN** env процесса и проектный `.env` не содержат project key
- **WHEN** context выбирает auto credential policy
- **THEN** MCP MUST сохранить существующий fallback на user session

#### Scenario: Один server обслуживает повторные вызовы

- **WHEN** содержимое проектного `.env` изменилось между двумя вызовами MCP tool
- **THEN** следующий вызов MUST разрешить новый снимок env проекта
- **THEN** предыдущий вызов MUST использовать один согласованный снимок значений

### Requirement: Простое обнаружение версий и предметных данных

MCP SHALL предоставлять design_system_versions_list, design_system_version_get, design_system_changes_list, tenants_list, token_groups_list и palette_get через существующие серверные операции.

#### Scenario: Фильтры и продолжение

- **WHEN** вызывается новый списковый tool
- **THEN** MCP MUST передать limit=50 при отсутствии аргумента, фильтры и cursor серверу, а не обходить полный каталог
- **THEN** version_get MUST использовать точный серверный фильтр номера, метаданные UUID либо существующие метаданные черновика

#### Scenario: Приоритет версии

- **WHEN** аргумент version задан явно
- **THEN** он MUST перекрыть версию контекста
- **WHEN** выбор отсутствует
- **THEN** чтение модели MUST выбрать draft
- **THEN** неправильный designSystem MUST NOT приводить к переходу на локальный конфиг или другого actor

#### Scenario: Транспортные метаданные

- **WHEN** сервер вернул страницу массива и HTTP-заголовки чтения
- **THEN** MCP MUST вернуть структурированные context/items/nextCursor без требования обёртки HTTP-тела
- **THEN** отсутствие обязательных метаданных ограниченной страницы MUST дать BACKEND_UNAVAILABLE, а не ложное успешное завершение списка

### Requirement: Ссылка на DS без обязательной платформы

Клиент SHALL принимать ссылку `dsbuilder://projects/{projectId}/design-systems/{designSystemId}?version={version}` без platform. Явный platform SHALL оставаться поддерживаемым, неизвестное значение SHALL отклоняться. Отсутствующая платформа SHALL NOT подменяться платформой по умолчанию или значением из локального workspace.

#### Scenario: Чтение модели по ссылке из UI

- **WHEN** пользователь копирует ссылку MCP в тулбаре текущей DS
- **THEN** ссылка MUST содержать projectId, designSystemId и текущую версию (draft или публикацию) без обязательного platform
- **THEN** чтения, не требующие платформы, MUST разрешать контекст с пустым списком платформ
- **THEN** платформенные операции MUST сохранить явное уточнение платформы, если она необходима для операции

### Requirement: API URL задаётся окружением

CLI и MCP launcher SHALL использовать `DSBUILDER_API_URL` для выбора backend и SHALL NOT принимать опцию `--api-url` ни в одной команде. При отсутствии переменной SHALL сохраняться существующий адрес по умолчанию. Успешный login SHALL NOT сохранять активный API URL как отдельную настройку. Локальный `.env` SHALL сохранять существующие правила разрешения контекста; явная ссылка SHALL NOT читать `.env` workspace.

#### Scenario: Общий backend для login и MCP

- **WHEN** CLI auth и MCP запущены с одинаковой переменной окружения DSBUILDER_API_URL
- **THEN** они MUST использовать одинаковый API URL и соответствующую ему сохранённую сессию
- **THEN** переданный `--api-url` MUST отклоняться до сетевых запросов

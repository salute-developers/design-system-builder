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

После второго этапа MCP SHALL предоставлять 27 инструментов чтения из design.md add-composite-read-tools через общий прикладной слой обоих launcher. Пять новых имён дополняют 22 инструмента первого этапа.

#### Scenario: design_system_get_context не раскрывает credential

- **WHEN** клиент вызывает design_system_get_context
- **THEN** результат MUST сохранить безопасный разрешённый контекст, API URL и доступные метаданные фактической версии
- **THEN** ключ проекта, access/refresh token и пароль MUST отсутствовать

#### Scenario: project_get_status проверяет backend

- **WHEN** клиент вызывает project_get_status
- **THEN** инструмент MUST сохранить общий сценарий проверки проекта/DS без выбора версии и разбора CLI

#### Scenario: Реестр первого этапа

- **WHEN** клиент вызывает tools/list любого launcher
- **THEN** имена MUST быть design_system_get_context, project_get_status, design_system_versions_list, design_system_version_get, design_system_changes_list, tenants_list, tokens_list, token_get, token_values_get, token_groups_list, palette_get, components_list, component_get, component_styles_get, component_variations_get, component_properties_get, component_dependencies_get, component_configurations_list, component_config_get, component_tokens_get, documentation_publications_list, documentation_search, documentation_fetch, documentation_get_navigation, documentation_get_page, code_binding_search и code_binding_get
- **THEN** инструменты MUST оставаться read-only, а initialize/tools/list MUST работать без credentials и workspace

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

MCP SHALL использовать существующие gateway-маршруты документации и серверные проекции. Разрешение точного publicationId отдельным HTTP-запросом SHALL быть допустимо без локальных предметных вычислений.

#### Scenario: Documentation search returns structured results

- **WHEN** документационный поиск получает query, subjects[], limit, cursor и селектор публикации
- **THEN** subjects MUST передаваться повторяющимися subject без изменения текущей возможности бэкенда
- **THEN** результат MUST сохранять фрагменты, привязки, subjects, kbUrl и числовой nextCursor
- **THEN** MCP MUST читать фактический publicationId из заголовка и передавать его с исходными фильтрами для продолжения

#### Scenario: Documentation fetch reads knowledge chunk

- **WHEN** documentation_fetch получает kbUrl
- **THEN** MCP MUST запросить существующий kb/fetch с detail=compact
- **THEN** markdown и метаданные MUST сохраниться, searchText MUST отсутствовать, публикация MUST определяться kbUrl

#### Scenario: Documentation navigation and pages read active publication

- **WHEN** documentation_get_navigation либо documentation_get_page получает точные version/platform без publicationId
- **THEN** MCP MUST разрешить ID через publications/active и вызвать существующий ID-маршрут
- **WHEN** publicationId задан явно
- **THEN** предварительное разрешение active MUST NOT требоваться
- **THEN** 401/403/503 MUST сохранить AUTH_REQUIRED/FORBIDDEN/BACKEND_UNAVAILABLE вместо PUBLICATION_NOT_FOUND

#### Scenario: Documentation read requires an exact version selection

- **WHEN** publicationId отсутствует, а аргументы/контекст не определяют точные version/platform
- **THEN** MCP MUST вернуть AMBIGUOUS_CONTEXT без latest, 0.0.0 или платформы по умолчанию
- **WHEN** запрошен draft
- **THEN** MCP MUST вернуть INVALID_QUERY
- **WHEN** publicationId задан явно
- **THEN** унаследованные version/platform MUST NOT препятствовать его чтению, но явно несовместимые параметры MUST быть отклонены

### Requirement: MCP code binding read tools

MCP SHALL читать опубликованные CodeBinding через существующие ID-маршруты с явным запросом серверных проекций. Они MUST NOT представляться авторитетной конфигурационной моделью.

#### Scenario: Code binding search filters by subject and kind

- **WHEN** переданы subject, kind, name, limit, cursor и селектор публикации
- **THEN** MCP MUST передать существующие фильтры, сохранить подстрочную семантику name и явно запросить detail=summary
- **THEN** результат MUST содержать компактные ID, subjects, kinds, names, platforms и nextCursor

#### Scenario: Code binding get resolves an exact reference

- **WHEN** передан bindingId
- **THEN** результат MUST содержать выбранную привязку либо NOT_FOUND с сохранением категорий доступа и недоступности

#### Scenario: Component binding get returns bounded response detail

- **WHEN** detail и variationNames отсутствуют в вызове tool
- **THEN** MCP MUST явно передать detail=summary и получить оформления, оси, defaults и counts без развёрнутых вариаций/styleApi
- **WHEN** variationNames задан без detail
- **THEN** MCP MUST передать detail=variations
- **WHEN** явно передан detail=summary вместе с variationNames
- **THEN** tool MUST вернуть INVALID_ARGUMENT
- **WHEN** detail=full
- **THEN** результат MUST сохранить полный опубликованный payload после серверной фильтрации

#### Scenario: Component binding get filters opaque appearance and variation names

- **WHEN** заданы appearanceNames или variationNames
- **THEN** MCP MUST передать точные имена серверу без локальной фильтрации или интерпретации как осей

#### Scenario: Tool descriptions route published code variation queries

- **WHEN** агент ищет опубликованные варианты кода
- **THEN** описания MUST направлять его к code_binding_search и code_binding_get
- **THEN** components_list и component_variations_get MUST обозначать данные как модель конфигурации

#### Scenario: Code bindings are not authoritative system model

- **WHEN** сервер доказал соответствие привязки модели
- **THEN** componentId SHALL передаваться для продолжения через component_config_get
- **WHEN** соответствие не доказано
- **THEN** поле MUST отсутствовать без сопоставления по похожему имени

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

MCP SHALL читать авторитетную модель выбранной версии через общие серверные операции без локальной сборки конфигурации или обхода каталога токенов. Списки, чтение меты component_get и адресация вариаций по appearanceId SHALL сохранить правила первого Change.

#### Scenario: Component list reads system components

- **WHEN** переданы name либо query, platform, limit, cursor или version
- **THEN** фильтры MUST выполняться сервером, а MCP MUST явно передавать limit=50 по умолчанию
- **THEN** список MUST NOT восстанавливаться из документации или обрезаться локально
- **THEN** name и query вместе MUST быть отклонены

#### Scenario: Component config get reads authoritative config

- **WHEN** component_config_get получает appearanceId и selectedValueIds
- **THEN** MCP MUST вызвать серверное чтение итоговых параметров одной предметной операцией без локального расчёта приоритетов
- **THEN** результат MUST сохранить значения свойств, tokenId и ID/технические редакции записей-источников
- **THEN** subject/name и projection MUST NOT заменять appearanceId в новой схеме tool

#### Scenario: Мета компонента без выбора конфигурации

- **WHEN** component_get получает componentId
- **THEN** MCP MUST сохранить чтение меты через GET /components/{id} без выбора конфигурации и версии глобальной меты
- **THEN** отсутствие X-DS-Read-Context одной DS MUST NOT считаться ошибкой этого чтения

#### Scenario: Component styles and variations read model details

- **WHEN** component_styles_get получает componentId и необязательный version
- **THEN** результат MUST сохранить стабильные ID и поддержку name/limit/cursor по правилам первого Change
- **WHEN** component_variations_get получает appearanceId и необязательный version
- **THEN** MCP MUST сохранить чтение осей конкретной конфигурации и стабильные appearanceId и variationId по правилам первого Change

#### Scenario: Вариации конкретной конфигурации

- **WHEN** component_variations_get получает appearanceId и необязательный version
- **THEN** MCP MUST сохранить чтение GET /appearances/{id}/variations, существующие values/defaultStyleId и серверный контекст выбранной границы
- **THEN** схема и результат MUST NOT требовать нового include=values,defaults, componentId вместо appearanceId или локальной сборки конфигурации

#### Scenario: Аргументы и версия вариаций

- **WHEN** appearanceId отсутствует либо вместо него передан componentId
- **THEN** MCP MUST вернуть INVALID_QUERY
- **WHEN** version задан явно
- **THEN** он MUST перекрыть версию URI/контекста; без выбора MUST использоваться draft
- **THEN** NOT_FOUND MUST NOT превращаться в чтение draft

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

### Requirement: Четыре завершающих инструмента чтения

MCP SHALL добавить component_properties_get, component_dependencies_get, component_configurations_list, component_tokens_get и documentation_publications_list к реестру первого этапа, используя серверные операции и общий runtime.

#### Scenario: Детали и ссылки компонента

- **WHEN** вызывается properties либо dependencies
- **THEN** MCP MUST явно включить серверные платформенные параметры либо настройки переиспользования без клиентского обхода связей
- **WHEN** component_tokens_get получает appearanceId и полный набор selectedValueIds
- **THEN** результат MUST содержать проверенные tokenId, имена и пути использования без значений темы
- **THEN** неполный набор выбранных осей MUST вернуть INVALID_QUERY

#### Scenario: Список конфигураций

- **WHEN** component_configurations_list получает componentId и необязательную версию
- **THEN** MCP MUST вернуть доступные appearanceId, имена и признак конфигурации по умолчанию с серверной пагинацией
- **THEN** инструмент MUST NOT выдавать стили каталога как конфигурации

#### Scenario: Список публикаций

- **WHEN** вызывается documentation_publications_list с необязательными version/platform и пагинацией
- **THEN** MCP MUST вызвать новый список опубликованных выпусков, включая переиздания, без требования версии модели
- **THEN** контекст MUST содержать фактические данные документации без выдуманного versionId модели

#### Scenario: Один runtime и независимая авторизация

- **WHEN** вызывается составной tool
- **THEN** MCP MUST разрешить runtime один раз и сохранить actor/credential policy
- **THEN** отказ MUST NOT переключать пользователя на ключ или наоборот
- **THEN** доступность tools MUST NOT зависеть от готовности отдельного Change PKCE

### Requirement: Точные схемы и подсказки чтения MCP

Оба средства запуска MCP SHALL объявлять одинаковые обязательные аргументы, выбор версии и назначение каждого инструмента. Описание MUST отличать постраничные списки от чтений одного ресурса и объяснять переход от компонента к конфигурации, осям и итоговым свойствам.

#### Scenario: Обязательные входы
- **WHEN** клиент получает `tools/list`
- **THEN** схема MUST помечать обязательными `componentId`, `appearanceId`, `bindingId`, `kbUrl`, `path` и `query` только для тех инструментов, которые требуют эти поля
- **THEN** отсутствие `selectedValueIds` у `component_config_get` MUST оставаться допустимым для базовых свойств

#### Scenario: Выбор версии модели
- **WHEN** агент читает описание инструмента с выбором модельной версии
- **THEN** описание MUST указывать приоритет явного `version`, версии контекста и черновика
- **THEN** ответ MUST сохранять фактическую выбранную версию

#### Scenario: Поиск конфигурации
- **WHEN** агент читает описания компонентных инструментов
- **THEN** он MUST получить последовательность `components_list`, `component_configurations_list`, `component_variations_get`, `component_config_get` и назначение стабильных ID

### Requirement: Диагностика ошибок чтения MCP

MCP SHALL отличать нарушение формата ответа backend от временной недоступности, сохраняя безопасные сообщения без секретов и тел ответа.

#### Scenario: Некорректный ответ backend
- **WHEN** ответ backend содержит невалидный JSON или несогласованные метаданные чтения
- **THEN** MCP MUST вернуть отдельный код `INVALID_BACKEND_RESPONSE`, который клиент не должен трактовать как временный сбой

#### Scenario: Ошибка авторизации и входа
- **WHEN** чтение модели получает HTTP 401
- **THEN** MCP MUST вернуть `AUTH_REQUIRED` с подсказкой `dsbuilder auth login`

#### Scenario: Неизвестный аргумент
- **WHEN** инструмент чтения модели получает неподдерживаемый аргумент
- **THEN** ответ `INVALID_QUERY` MUST назвать этот аргумент

## MODIFIED Requirements

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
MCP SHALL читать компоненты из авторитетного API модели, передавая версии и фильтры серверу. Схема component_config_get сохраняется до add-composite-read-tools.

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

#### Scenario: Component styles and variations read model details
- **WHEN** клиент вызывает `component_styles_get` либо `component_variations_get` с `componentId` и необязательным `version`
- **THEN** MCP MUST вернуть детали оформления и метаданные осей из API модели
- **THEN** MCP MUST сохранить ID компонента и оформления для последующей адресации сущностей

#### Scenario: Ограниченное чтение оформлений

- **WHEN** component_styles_get получает name, limit или cursor
- **THEN** MCP MUST передать их серверу и вернуть серверный nextCursor, используя limit=50 по умолчанию


## ADDED Requirements

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

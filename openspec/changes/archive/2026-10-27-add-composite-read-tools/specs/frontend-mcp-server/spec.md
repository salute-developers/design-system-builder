## MODIFIED Requirements

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

## ADDED Requirements

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

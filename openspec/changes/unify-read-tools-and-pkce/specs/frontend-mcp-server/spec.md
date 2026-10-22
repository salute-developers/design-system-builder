## MODIFIED Requirements

### Requirement: Начальный набор MCP tools

Оба MCP launcher SHALL предоставлять ровно 26 инструментов чтения с именами и параметрами из реестра design.md через общий прикладной слой.

#### Scenario: Полный реестр

- **WHEN** клиент вызывает tools/list любого launcher
- **THEN** реестр MUST содержать design_system_get_context, project_get_status, design_system_versions_list, design_system_version_get, design_system_changes_list, tenants_list, tokens_list, token_get, token_values_get, token_groups_list, palette_get, components_list, component_get, component_styles_get, component_variations_get, component_properties_get, component_dependencies_get, component_config_get, component_tokens_get, documentation_publications_list, documentation_search, documentation_fetch, documentation_get_navigation, documentation_get_page, code_binding_search и code_binding_get
- **THEN** реестр MUST NOT содержать операции записи

#### Scenario: design_system_get_context не раскрывает credential

- **WHEN** клиент вызывает design_system_get_context
- **THEN** результат MUST содержать разрешённый контекст версии, API URL и безопасные локальные метаданные
- **THEN** результат MUST NOT содержать ключ проекта, access/refresh token или пароль

#### Scenario: project_get_status проверяет backend

- **WHEN** клиент вызывает project_get_status
- **THEN** инструмент MUST сохранить текущую проверку проекта и дизайн-системы общим сценарием без выбора версии и разбора вывода CLI

### Requirement: MCP контекст и credential не смешиваются

MCP SHALL описывать designSystem как выбор ресурса, а авторизацию как отдельную политику. URI MUST NOT интерпретироваться как API URL или credential.

#### Scenario: Проекция конфигурации компонента использует один runtime

- **WHEN** клиент вызывает component_config_get или component_tokens_get
- **THEN** MCP MUST разрешить runtime один раз и вызвать одну серверную предметную операцию
- **THEN** MCP MUST NOT загружать экспорт и каталог токенов для локальной сборки результата

#### Scenario: Неверная ссылка

- **WHEN** инструмент получает некорректный designSystem URI
- **THEN** он MUST вернуть INVALID_CONTEXT без перехода на локальный конфиг или другого actor

### Requirement: MCP documentation read tools

MCP SHALL предоставлять инструменты чтения документации через общие gateway-адаптеры с серверным разрешением публикаций и структурированными ответами.

#### Scenario: Documentation search returns structured results

- **WHEN** клиент вызывает documentation_search с query и необязательными subjects, limit, cursor, version, platform, publicationId
- **THEN** серверная операция MUST вернуть структурированные результаты с фрагментами, привязками к коду, subjects, kbUrl и nextCursor
- **THEN** результат MUST содержать фактическую publicationId без необходимости запуска shell-команд

#### Scenario: Documentation read requires an exact version selection

- **WHEN** инструмент не получил publicationId и контекст не задаёт точные version и platform
- **THEN** MCP MUST вернуть AMBIGUOUS_CONTEXT без подстановки latest, 0.0.0 или платформы по умолчанию
- **WHEN** выбрана версия draft
- **THEN** инструмент MUST вернуть INVALID_QUERY

#### Scenario: Documentation fetch reads knowledge chunk

- **WHEN** documentation_fetch получает kbUrl опубликованного фрагмента выбранной дизайн-системы
- **THEN** MCP MUST вернуть серверный компактный ответ с markdown и метаданными источника без searchText
- **THEN** версия и публикация MUST определяться kbUrl

#### Scenario: Documentation navigation and pages read active publication

- **WHEN** клиент вызывает documentation_get_navigation либо documentation_get_page с path
- **THEN** MCP MUST вызвать одну серверную операцию разрешения селектора и чтения
- **THEN** отсутствие публикации MUST вернуть PUBLICATION_NOT_FOUND, а 401/403/недоступность MUST сохранить исходную категорию ошибки

### Requirement: MCP code binding read tools

MCP SHALL предоставлять поиск и чтение опубликованных CodeBinding с серверными проекциями и фильтрами без представления их как авторитетной модели компонентов или токенов.

#### Scenario: Code binding search filters by subject and kind

- **WHEN** клиент передаёт subject, kind, name, limit, cursor и селектор публикации
- **THEN** одна серверная операция MUST вернуть компактные ID, subjects, kinds, names, platforms и nextCursor

#### Scenario: Code binding get resolves an exact reference

- **WHEN** code_binding_get получает bindingId
- **THEN** сервер MUST вернуть выбранную привязку либо NOT_FOUND для отсутствующей или недоступной привязки

#### Scenario: Component binding get returns bounded response detail

- **WHEN** detail и variationNames отсутствуют
- **THEN** сервер MUST вернуть summary с именами оформлений, осями, defaults и counts без развёрнутых вариаций и styleApi
- **WHEN** передан detail=variations либо variationNames без detail
- **THEN** сервер MUST вернуть конкретные ссылки вариантов кода без styleApi
- **WHEN** передан detail=full
- **THEN** сервер MUST сохранить полный опубликованный payload после фильтрации
- **WHEN** явно переданы detail=summary и variationNames
- **THEN** инструмент MUST вернуть INVALID_ARGUMENT

#### Scenario: Component binding get filters opaque appearance and variation names

- **WHEN** переданы appearanceNames или variationNames
- **THEN** сервер MUST фильтровать точные styleName и variation name без интерпретации имён как фиксированных осей
- **THEN** MCP MUST NOT выполнять эти вычисления локально

#### Scenario: Tool descriptions route published code variation queries

- **WHEN** агент ищет опубликованные варианты кода
- **THEN** описания MUST направлять его к code_binding_search и code_binding_get с detail=summary
- **THEN** components_list и component_variations_get MUST обозначать свои данные как конфигурационную модель

#### Scenario: Code bindings are not authoritative system model

- **WHEN** сервер доказуемо сопоставил привязку с компонентом выбранной версии
- **THEN** ответ SHALL содержать componentId для продолжения через component_config_get
- **THEN** при отсутствии доказуемого соответствия поле MUST отсутствовать, а документационные данные MUST NOT выдаваться за состояние модели

### Requirement: MCP token read tools

MCP SHALL читать токены только из авторитетного API модели, передавать выбор версии, фильтры и пагинацию серверу без локальной фильтрации и обрезки.

#### Scenario: Token list reads system tokens

- **WHEN** tokens_list получает type, name либо query, groupId, limit, cursor и version
- **THEN** сервер MUST вернуть items/nextCursor с ID, именами, типами, displayName и description
- **THEN** name и query вместе MUST быть отклонены
- **THEN** отсутствие limit MUST использовать серверный default 50

#### Scenario: Token get reads one system token

- **WHEN** token_get получает tokenId и version
- **THEN** результат MUST содержать данные токена выбранной дизайн-системы и версии, включая доступные ссылки и ревизии

#### Scenario: Token values get reads resolved values

- **WHEN** token_values_get получает tokenId и необязательные tenantId, mode, platform, version
- **THEN** сервер MUST вернуть значения с доступными метаданными исходных, ссылочных и разрешённых значений
- **THEN** отсутствие фильтров MUST NOT выбирать tenant или платформу неявно
- **THEN** platform MUST сохранять web/android/ios

### Requirement: MCP component read tools

MCP SHALL читать компоненты выбранной версии из API модели, передавая серверу фильтры и составные запросы без локальной сборки конфигурации.

#### Scenario: Component list reads system components

- **WHEN** components_list получает name либо query, platform, limit, cursor и version
- **THEN** сервер MUST применить фильтры до пагинации и вернуть компактные items/nextCursor
- **THEN** name и query вместе MUST быть отклонены
- **THEN** отсутствие limit MUST использовать серверный default 50

#### Scenario: Component config get reads authoritative config

- **WHEN** component_config_get получает componentId и необязательные style и объект selection
- **THEN** одна серверная операция MUST вернуть выбранную каноническую конфигурацию с доступными props, bindings, invariants, variations и ревизиями
- **THEN** старые subject/name и projection MUST NOT приниматься вместо componentId новым контрактом

#### Scenario: Component styles and variations read model details

- **WHEN** клиент вызывает component_get, component_styles_get или component_variations_get с componentId и version
- **THEN** результат MUST относиться к выбранной дизайн-системе и версии и сохранять стабильные ID
- **THEN** component_styles_get SHALL поддерживать name, limit и cursor

## ADDED Requirements

### Requirement: Новые инструменты обнаружения и связей

MCP SHALL предоставлять десять добавленных инструментов с параметрами реестра design.md и использовать общие серверные операции вместо обхода предметных связей на клиенте.

#### Scenario: Обнаружение данных

- **WHEN** клиент вызывает design_system_versions_list, design_system_version_get, design_system_changes_list, tenants_list, token_groups_list, palette_get либо documentation_publications_list
- **THEN** инструмент MUST вернуть серверный результат в выбранном контексте с заявленными фильтрами и пагинацией

#### Scenario: Детали компонента

- **WHEN** клиент вызывает component_properties_get либо component_dependencies_get
- **THEN** одна серверная операция MUST вернуть соответственно свойства с платформенными параметрами либо зависимости с настройками переиспользования

#### Scenario: Токены конфигурации

- **WHEN** component_tokens_get получает componentId и полный selection
- **THEN** одна серверная операция MUST вернуть проверенные tokenId, имена и места использования без значений темы
- **THEN** неполный выбор MUST завершиться INVALID_QUERY

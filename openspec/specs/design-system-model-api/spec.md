# design-system-model-api Specification

## Purpose
TBD - created by archiving change add-mcp-design-system-read-tools. Update Purpose after archive.
## Requirements
### Requirement: Project-scoped token read API
API предметной модели DS Builder SHALL предоставлять через `ds-service` project-scoped endpoints чтения эталонных токенов и их значений.

#### Scenario: Список токенов дизайн-системы
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tokens`
- **THEN** API MUST вернуть краткие данные токенов из системного источника истины
- **THEN** ответ MUST сохранить существующую форму массива
- **THEN** ответ MUST поддерживать необязательные фильтры типа токена и текстового запроса
- **THEN** `ds-service` MUST проверить, что запрошенная дизайн-система принадлежит trusted `X-Project-Id` или глобально доступна этому проекту
- **THEN** `ds-service` MUST потребовать `tokens:read`
- **THEN** ответ MUST NOT строиться из публикаций документации

#### Scenario: Чтение токена по стабильному идентификатору
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/ds/tokens/{tokenId}`
- **THEN** API MUST вернуть эталонный DTO токена с идентификатором, типом, отображаемыми метаданными и метаданными ревизии при их наличии
- **THEN** `ds-service` MUST проверить, что токен принадлежит дизайн-системе, доступной trusted `X-Project-Id`
- **THEN** API MUST вернуть `404`, если токен не принадлежит trusted project

#### Scenario: Чтение значений токена с фильтрами
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/ds/tokens/{tokenId}/values` с необязательными фильтрами темы, режима или платформы
- **THEN** API MUST вернуть эталонные DTO значений токена из системной модели
- **THEN** API MUST сохранить метаданные исходного, ссылочного и разрешённого значения, если эти понятия представлены в исходной модели

#### Scenario: Стабильность существующих маршрутов токенов
- **WHEN** MCP читает один токен или его значения по стабильному идентификатору
- **THEN** API MUST использовать `/ds/tokens/{tokenId}` и `/ds/tokens/{tokenId}/values`
- **THEN** эти маршруты MUST проверять project ownership и `tokens:read`, не добавляя дублирующих маршрутов поиска через дизайн-систему

### Requirement: Project-scoped component read API
API предметной модели DS Builder SHALL предоставлять через `ds-service` project-scoped endpoints чтения эталонных данных компонентов, конфигураций, стилей и вариаций.

#### Scenario: Список компонентов дизайн-системы
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/components`
- **THEN** API MUST вернуть краткие данные компонентов из системного источника истины
- **THEN** ответ MUST включать стабильные идентификаторы компонентов и имена доступных стилей
- **THEN** ответ MUST сохранить существующую форму массива
- **THEN** ответ MUST поддерживать необязательный текстовый запрос
- **THEN** `ds-service` MUST проверить, что дизайн-система принадлежит trusted `X-Project-Id` или глобально доступна проекту
- **THEN** `ds-service` MUST потребовать `components:read`

#### Scenario: Чтение компонента
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/ds/components/{componentId}`
- **THEN** API MUST вернуть эталонные метаданные компонента и доступные ссылки на конфигурацию
- **THEN** `ds-service` MUST проверить связь компонента с дизайн-системой, доступной trusted project
- **THEN** API MUST вернуть `404`, если компонент не принадлежит trusted project

#### Scenario: Чтение пакета конфигураций компонентов
- **WHEN** аутентифицированный клиент вызывает `POST /api/projects/{projectId}/ds/component-config/export` с `designSystemId` и необязательными фильтрами `components` или `styles`
- **THEN** API MUST вернуть эталонный пакет конфигураций с именами компонентов, стилей и канонической общей конфигурацией
- **THEN** API MUST ограничить пакет указанными фильтрами компонентов и стилей
- **THEN** API MUST потребовать `components:read`

#### Scenario: Чтение одной конфигурации из пакетного контракта
- **WHEN** MCP требуется `component_config_get` для одного компонента и необязательного стиля
- **THEN** frontend application layer MUST вызвать `POST /ds/component-config/export` с фильтрами компонента и стиля, когда backend их поддерживает
- **THEN** API MUST вернуть каноническую общую конфигурацию

#### Scenario: Чтение стилей и вариаций компонента
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/components/{componentId}/styles` или `GET /api/projects/{projectId}/ds/components/{componentId}/variations`
- **THEN** API MUST вернуть эталонные DTO стилей и вариаций из системной модели
- **THEN** ответ MUST включать стабильные идентификаторы для сопоставления модельных данных с code bindings
- **THEN** только styles endpoint MUST оставаться design-system-scoped, поскольку он агрегирует стили вариаций с фильтром дизайн-системы

### Requirement: No backend pagination in first read tools version
Token and component model reads SHALL avoid introducing backend cursor pagination in this change.

#### Scenario: Existing list shape remains array-based
- **WHEN** token or component list endpoints are extended for MCP reads
- **THEN** the backend MUST keep array-based responses for existing list endpoints
- **THEN** MCP-specific result limiting, if needed, MUST be handled in frontend application or MCP presentation layer

#### Scenario: Existing component routes are stabilized
- **WHEN** implementation reuses existing `/ds/components`, `/ds/styles`, `/ds/variations` or `/ds/component-config/export` logic internally
- **THEN** ID-based component detail and variation reads MUST reuse `/ds/components/{componentId}` and `/ds/components/{componentId}/variations` with project/scope checks
- **THEN** the external read contract MUST provide the aggregate design-system component styles response without requiring MCP clients to issue one request per variation

### Requirement: Gateway authorization for model read API
Gateway SHALL публиковать API чтения токенов и компонентов через project-scoped authorization и trusted project context, а `ds-service` SHALL независимо проверять этот контекст.

#### Scenario: Существующий маршрут Gateway передаёт разрешённый запрос
- **WHEN** аутентифицированный клиент вызывает endpoint чтения токена или компонента через `/api/projects/{projectId}/ds/...`
- **THEN** Gateway MUST проверить project-scoped authentication по существующей семантике пользовательской сессии или project access key
- **THEN** Gateway MUST передать trusted project context в `ds-service`
- **THEN** изменение MUST NOT требовать второго публичного маршрута, если путь уже покрыт `/api/projects/{projectId}/ds/...`

#### Scenario: Неавторизованный запрос отклоняется
- **WHEN** клиент вызывает endpoint чтения токена или компонента без действительной project-scoped authentication
- **THEN** Gateway MUST отклонить запрос с `401` или `403`
- **THEN** `ds-service` MUST отклонить отсутствующий или противоречивый trusted context при прямом обращении
- **THEN** `ds-service` MUST NOT выводить trusted project identity только из управляемых клиентом path или query parameters

### Requirement: Stable DTO boundary for model reads
Token and component read endpoints SHALL return explicit API DTOs rather than persistence rows or UI-only shapes.

#### Scenario: API response hides persistence details
- **WHEN** model API returns tokens, token values, components, configs, styles or variations
- **THEN** response DTOs MUST contain stable public fields documented by the API contract
- **THEN** response DTOs MUST NOT expose database-only columns, internal join-table structure or raw implementation-specific rows

#### Scenario: API errors map to client-readable codes
- **WHEN** model API rejects a read request due to invalid arguments, missing entity, authorization failure or backend availability
- **THEN** the API MUST return a status and error body that frontend application use cases can map to stable MCP codes

### Requirement: Web client compatibility
Model read API changes SHALL preserve existing `js/apps/client` behavior unless that client is intentionally migrated in the same implementation.

#### Scenario: Existing web client endpoints remain compatible
- **WHEN** this change adds filters, DTOs or project/scope checks for MCP-oriented model reads
- **THEN** existing endpoints and response shapes used by `js/apps/client` MUST remain backward-compatible
- **THEN** the implementation MUST NOT require unrelated changes in `js/apps/client` only to keep current UI scenarios working

#### Scenario: Frontend Kotlin clients may migrate
- **WHEN** new read DTOs affect `frontend-kt/cli` or shared frontend application use cases
- **THEN** the implementation MAY update `frontend-kt/cli` together with the shared use cases
- **THEN** CLI changes MUST preserve documented command behavior or update CLI documentation in the same change

### Requirement: Полный разрешённый набор предметных маршрутов

`ds-service` SHALL реализовать приведённый ниже набор маршрутов относительно публичного префикса `P = /api/projects/{projectId}/ds` и внутреннего префикса `/api/ds` после переписывания Gateway. Маршрут, отсутствующий в этом наборе, MUST NOT публиковаться OpenAPI нового сервиса.

| Ресурс | Обязательные маршруты относительно `P` |
|---|---|
| Дизайн-системы | `GET /design-systems`, `GET /design-systems/{id}`, `POST /design-systems`, `PATCH /design-systems/{id}`, `DELETE /design-systems/{id}`, `GET /design-systems/{id}/components`, `GET /design-systems/{id}/tokens`, `GET /design-systems/{id}/components/{componentId}/styles`, `GET /design-systems/{id}/tenants`, `GET /design-systems/{id}/appearances`, `GET /design-systems/{id}/changes` |
| Версии дизайн-систем | `GET /design-system-versions`, `GET /design-system-versions/{id}`, `GET /design-system-versions/by-design-system/{designSystemId}`, `POST /design-system-versions`, `PATCH /design-system-versions/{id}`, `DELETE /design-system-versions/{id}` |
| Журнал изменений | `GET /design-system-changes`, `GET /design-system-changes/{id}`, `GET /design-system-changes/by-design-system/{designSystemId}`, `POST /design-system-changes` |
| Темы | `GET /tenants`, `GET /tenants/{id}`, `POST /tenants`, `PATCH /tenants/{id}`, `DELETE /tenants/{id}`, `GET /tenants/{id}/token-values` |
| Токены | `GET /tokens`, `GET /tokens/{id}`, `POST /tokens`, `PATCH /tokens/{id}`, `DELETE /tokens/{id}`, `GET /tokens/{id}/values` |
| Значения токенов | `GET /token-values`, `GET /token-values/{id}`, `POST /token-values`, `PATCH /token-values/{id}`, `DELETE /token-values/{id}` |
| Палитра | `GET /palette`, `GET /palette/{id}`, `GET /palette/by-type/{type}`, `POST /palette`, `PATCH /palette/{id}`, `DELETE /palette/{id}` |
| Компоненты | `GET /components`, `GET /components/{id}`, `POST /components`, `PATCH /components/{id}`, `DELETE /components/{id}`, `GET /components/{id}/variations`, `GET /components/{id}/properties`, `GET /components/{id}/deps` |
| Компоненты дизайн-систем | `GET /design-system-components`, `GET /design-system-components/{id}`, `POST /design-system-components`, `DELETE /design-system-components/{id}` |
| Зависимости компонентов | `GET /component-deps`, `GET /component-deps/{id}`, `POST /component-deps`, `PATCH /component-deps/{id}`, `DELETE /component-deps/{id}` |
| Конфигурации повторного использования | `GET /component-reuse-configs`, `GET /component-reuse-configs/{id}`, `GET /component-reuse-configs/by-dep/{componentDepId}`, `POST /component-reuse-configs`, `PATCH /component-reuse-configs/{id}`, `DELETE /component-reuse-configs/{id}` |
| Вариации | `GET /variations`, `GET /variations/{id}`, `POST /variations`, `PATCH /variations/{id}`, `DELETE /variations/{id}`, `GET /variations/{id}/styles`, `GET /variations/{id}/properties` |
| Свойства | `GET /properties`, `GET /properties/{id}`, `POST /properties`, `PATCH /properties/{id}`, `DELETE /properties/{id}` |
| Параметры платформы свойства | `GET /property-platform-params`, `GET /property-platform-params/{id}`, `POST /property-platform-params`, `PATCH /property-platform-params/{id}`, `DELETE /property-platform-params/{id}` |
| Связи свойства и вариации | `GET /property-variations`, `GET /property-variations/{id}`, `POST /property-variations`, `DELETE /property-variations/{id}` |
| Корректировки параметров вариации | `GET /variation-platform-param-adjustments`, `GET /variation-platform-param-adjustments/{id}`, `POST /variation-platform-param-adjustments`, `PATCH /variation-platform-param-adjustments/{id}`, `DELETE /variation-platform-param-adjustments/{id}` |
| Корректировки инвариантных параметров | `GET /invariant-platform-param-adjustments`, `GET /invariant-platform-param-adjustments/{id}`, `POST /invariant-platform-param-adjustments`, `PATCH /invariant-platform-param-adjustments/{id}`, `DELETE /invariant-platform-param-adjustments/{id}` |
| Внешние виды | `GET /appearances`, `GET /appearances/{id}`, `POST /appearances`, `PATCH /appearances/{id}`, `DELETE /appearances/{id}`, `GET /appearances/{id}/variations` |
| Вариации внешнего вида | `GET /appearance-variations`, `GET /appearance-variations/{id}`, `POST /appearance-variations`, `PATCH /appearance-variations/{id}`, `DELETE /appearance-variations/{id}` |
| Значения вариаций внешнего вида | `GET /appearance-variation-values`, `GET /appearance-variation-values/{id}`, `POST /appearance-variation-values`, `PATCH /appearance-variation-values/{id}`, `DELETE /appearance-variation-values/{id}` |
| Стили | `GET /styles`, `GET /styles/{id}`, `GET /styles/by-variation/{variationId}/by-design-system/{designSystemId}`, `POST /styles`, `PATCH /styles/{id}`, `DELETE /styles/{id}` |
| Значения свойств вариаций | `GET /variation-property-values`, `GET /variation-property-values/{id}`, `GET /variation-property-values/by-style/{styleId}`, `GET /variation-property-values/by-appearance/{appearanceId}`, `POST /variation-property-values`, `PATCH /variation-property-values/{id}`, `DELETE /variation-property-values/{id}` |
| Инвариантные значения свойств | `GET /invariant-property-values`, `GET /invariant-property-values/{id}`, `GET /invariant-property-values/by-component/{componentId}/by-design-system/{designSystemId}`, `POST /invariant-property-values`, `PATCH /invariant-property-values/{id}`, `DELETE /invariant-property-values/{id}` |
| Состояния | `GET /states`, `GET /states/{id}`, `POST /states`, `PATCH /states/{id}`, `DELETE /states/{id}`, `GET /states/{id}/impact` |
| Наборы состояний | `GET /state-sets`, `GET /state-sets/{id}`, `POST /state-sets/resolve` |
| Комбинации стилей | `GET /style-combinations`, `GET /style-combinations/{id}`, `POST /style-combinations`, `PATCH /style-combinations/{id}`, `DELETE /style-combinations/{id}`, `GET /style-combinations/{id}/members`, `POST /style-combinations/{id}/members` |
| Элементы комбинаций стилей | `GET /style-combination-members`, `GET /style-combination-members/{id}`, `POST /style-combination-members`, `DELETE /style-combination-members/{id}` |
| Конфигурация компонента | `GET /component-config?ds={ds}&version={version}&appearance={appearance}&component={component}`, `POST /component-config/import`, `POST /component-config/export` |

#### Scenario: Проверка route manifest

- **WHEN** контрактный тест перечисляет маршруты `ds-service`
- **THEN** каждый маршрут из таблицы MUST существовать с указанным HTTP-методом
- **AND** сервис MUST NOT добавлять предметный маршрут вне таблицы без нового OpenSpec-изменения

#### Scenario: Доступ через внешний и внутренний префиксы

- **WHEN** клиент вызывает любой маршрут таблицы через `P`
- **THEN** Gateway MUST передать тот же остаток пути в `ds-service` под `/api/ds`
- **AND** публичный DTO MUST NOT содержать детали внутреннего переписывания пути

### Requirement: Исключённые маршруты не входят в Kotlin-сервис

`ds-service` MUST NOT реализовывать маршруты `documentation-pages`, `saved-queries`, `/legacy/**` и `/api/admin/**`, а также операции генерации артефактов.

| Исключённая область | Маршруты, от которых отказывается `ds-service` |
|---|---|
| Документация | `GET /documentation-pages`, `GET /documentation-pages/{id}`, `GET /documentation-pages/by-design-system/{designSystemId}`, `POST /documentation-pages`, `PATCH /documentation-pages/{id}`, `DELETE /documentation-pages/{id}` |
| Сохранённые запросы | `GET /saved-queries`, `GET /saved-queries/{id}`, `POST /saved-queries`, `PATCH /saved-queries/{id}`, `DELETE /saved-queries/{id}`, `GET /saved-queries/{id}/run` |
| Legacy | `GET /legacy/design-systems/{name}/component-configs`, `GET /legacy/design-systems/{name}/theme-data`, `GET /legacy/design-systems/{name}/tenant-params`, `POST /legacy/design-systems/create`, `POST /legacy/design-systems/{name}/update`, `GET /legacy/design-systems/{name}/download-theme` |
| Администрирование | `GET /api/admin/tables`, `GET /api/admin/tables/{name}`, `GET /api/admin/queries`, `GET /api/admin/queries/{id}`, `POST /api/admin/nl-query`, `GET /api/admin/schema` |

Отдельных смонтированных маршрутов генерации в текущем предметном router нет; `download-theme` считается legacy-операцией и исключён явно.

#### Scenario: Запрос исключённого маршрута напрямую в ds-service

- **WHEN** запрос приходит в `ds-service` по исключённому пути
- **THEN** сервис MUST вернуть `404 Not Found`
- **AND** OpenAPI `ds-service` MUST NOT описывать этот путь

#### Scenario: Совместное существование с db-service

- **WHEN** исключённый маршрут временно требуется существующему потребителю
- **THEN** Gateway MAY сохранить более специфичную маршрутизацию этого пути в `db-service`
- **AND** это MUST NOT добавлять исключённый маршрут в контракт `ds-service`

### Requirement: Gateway compatibility routing для исключённых API

Gateway MUST направлять `/api/projects/{projectId}/ds/legacy/**` и `/api/projects/{projectId}/ds/saved-queries/**` в `db-service` с существующим project-scoped trusted context. Gateway MUST направлять `/api/admin/**` в `db-service` с существующей user-authentication семантикой. `documentation-pages` MUST NOT получать fallback внутри `/ds/**`, поскольку принадлежит `documentation-service`.

#### Scenario: Сохранённый запрос остаётся доступен во время миграции

- **WHEN** авторизованный principal вызывает `/api/projects/{projectId}/ds/saved-queries`
- **THEN** Gateway проксирует запрос в `db-service`
- **AND** `ds-service` не обрабатывает этот маршрут

### Requirement: Совместимость перенесённого API

Каждый перенесённый маршрут SHALL сохранять наблюдаемый контракт текущего `db-service`: имена и обязательность path/query/body полей, форму JSON, семантику `null` и отсутствующих полей, коды успешных ответов, предметные ошибки, порядок элементов там, где он стабилен, и транзакционные границы.

#### Scenario: Сравнение чтения двух реализаций

- **WHEN** `db-service` и `ds-service` получают один запрос чтения на эквивалентных данных
- **THEN** статусы и JSON-ответы MUST совпасть после нормализации только документированных недетерминированных значений

#### Scenario: Сравнение мутации двух реализаций

- **WHEN** одинаковая допустимая мутация выполняется в отдельных эквивалентных базах
- **THEN** обе реализации MUST вернуть совместимые ответы
- **AND** итоговое состояние предметных таблиц MUST быть эквивалентным

#### Scenario: Версия в текущем component-config

- **WHEN** клиент вызывает `GET /component-config` с обязательным параметром `version`
- **THEN** `ds-service` MUST принять и валидировать наличие параметра
- **AND** MUST сохранить текущее поведение выбора данных без новой исторической семантики версии

### Requirement: Явные DTO предметного API

`ds-service` SHALL определять отдельные сериализуемые request/response DTO на границе HTTP и MUST NOT сериализовать domain-объекты, Exposed rows или структуры таблиц напрямую.

#### Scenario: Отображение ответа

- **WHEN** use case возвращает предметный результат
- **THEN** presentation-слой MUST преобразовать его в DTO совместимого контракта
- **AND** внутренние поля хранения и связи MUST NOT появляться в JSON без явного поля DTO

#### Scenario: Отображение ошибки

- **WHEN** запрос недопустим, ресурс не найден, permission отсутствует или БД недоступна
- **THEN** presentation-слой MUST вернуть стабильный HTTP-статус и совместимое тело ошибки
- **AND** ответ MUST NOT содержать stack trace, SQL или сведения о владельце чужого ресурса

### Requirement: Совместимый контракт профилей и preview тем

`ds-service` SHALL воспроизводить актуальный контракт `db-service` из `feature/projects-workflow`: `POST /tenants` принимает `profile` (`sber`, `malachite`, `b2b` или `custom`) и для `custom` обязательный `customPalette`; ответы `Tenant` содержат `editRevision` и `preview`; список тем и агрегаты дизайн-систем SHALL возвращать вычисленные preview без раскрытия внутренних данных токенов.

#### Scenario: Создание темы с профилем

- **WHEN** principal с `tenants:write` создаёт тему доступной дизайн-системы с валидным профилем
- **THEN** `ds-service` MUST нормализовать имя и создать тему с `editRevision = 0`
- **AND** MUST создать начальные значения токенов в той же транзакционной границе
- **AND** ответ MUST быть совместим с DTO `Tenant` текущего `db-service`

#### Scenario: Дублирующее имя темы

- **WHEN** в одной дизайн-системе создаётся или переименовывается тема с совпадающим после нормализации и приведения регистра именем
- **THEN** `ds-service` MUST вернуть `409 Conflict` с кодом `TENANT_NAME_CONFLICT`
- **AND** MUST NOT изменить существующую тему

### Requirement: Пакетное сохранение значений темы с optimistic concurrency

`ds-service` SHALL публиковать `PUT /tenants/{id}/token-values` с массивом значений и обязательным `editRevision`. Операция MUST проверить `tenants:write`, ownership темы, принадлежность каждого токена дизайн-системе темы и уникальность комбинации `tokenId/platform/mode`.

#### Scenario: Успешное пакетное сохранение

- **WHEN** клиент передаёт актуальный `editRevision` и валидный уникальный набор значений
- **THEN** сервис MUST атомарно заменить platform-specific значения темы
- **AND** MUST вернуть увеличенный `editRevision`

#### Scenario: Конфликт параллельного изменения

- **WHEN** переданный `editRevision` отличается от сохранённого
- **THEN** сервис MUST вернуть `409 Conflict` с кодом `TENANT_EDIT_CONFLICT` и актуальным `editRevision`
- **AND** MUST NOT заменить ни одно значение токена

### Requirement: Компонент идентифицируется именем и платформой

`ds-service` SHALL хранить и отдавать компонент с обязательной платформой (`web`, `compose`, `xml`, `ios`) и идентифицировать его парой `(name, platform)`. Создание компонента MUST требовать `platform` и MUST отвечать `400` без него или со значением вне словаря. Ответы свойств, appearances и сводки appearances дизайн-системы MUST NOT содержать собственной платформы: она определяется компонентом.

#### Scenario: Одно имя на двух платформах

- **WHEN** создаются компоненты `Avatar` для `compose` и для `xml`
- **THEN** `ds-service` MUST создать две разные записи с собственными идентификаторами

#### Scenario: Платформа обязательна при создании

- **WHEN** тело `POST /components` не содержит `platform` или содержит значение вне словаря
- **THEN** `ds-service` MUST ответить `400` и MUST NOT создать компонент

#### Scenario: Дубликат пары

- **WHEN** создаётся компонент с уже существующей парой `(name, platform)`
- **THEN** `ds-service` MUST отклонить запись и MUST NOT создать второй компонент

#### Scenario: Игнорируемое поле платформы

- **WHEN** тело создания или изменения appearance или свойства содержит `platform`
- **THEN** `ds-service` MUST принять запрос и MUST игнорировать поле

### Requirement: Признак устаревания платформенного имени

`ds-service` SHALL принимать и возвращать у `property-platform-params` поля `deprecated` (boolean, по умолчанию `false`) и `deprecatedMessage`. Явный `null` в `deprecatedMessage` при изменении MUST очищать сообщение; отсутствие поля MUST оставлять его прежним. Платформа алиаса MUST совпадать с платформой компонента его свойства.

#### Scenario: Устаревший алиас с сообщением

- **WHEN** создаётся алиас с `deprecated: true` и сообщением
- **THEN** ответ MUST содержать эти значения

#### Scenario: Пустое сообщение

- **WHEN** алиас изменяется с `deprecated: true` и `deprecatedMessage: ""`
- **THEN** сообщение MUST быть пустой строкой, а не `null`

#### Scenario: Сообщение без пометки

- **WHEN** алиас изменяется с `deprecated: false` и непустым `deprecatedMessage`
- **THEN** `ds-service` MUST отклонить запись

#### Scenario: Алиас чужой платформы

- **WHEN** создаётся алиас платформы, не совпадающей с платформой компонента свойства
- **THEN** `ds-service` MUST отклонить запись

### Requirement: Платформа в component-config

`GET /component-config` SHALL требовать query-параметр `platform`, а `POST /component-config/import` и `POST /component-config/export` — поле тела `platform`; без платформы или со значением вне словаря `ds-service` MUST отвечать `400`. Компонент MUST выбираться только среди компонентов этой платформы, экспорт MUST отдавать конфигурации только компонентов этой платформы, а конфигурация без компонента на платформе импорта MUST отклоняться с причиной, называющей платформу. Запись журнала `components:import` MUST содержать `platform`.

#### Scenario: Импорт в компонент своей платформы

- **WHEN** есть компоненты `Button` для `web` и `compose` и выполняется импорт с `platform: compose`
- **THEN** appearance MUST появиться только у компонента `compose`

#### Scenario: Чтение без платформы

- **WHEN** запрос `GET /component-config` не содержит `platform`
- **THEN** `ds-service` MUST ответить `400`

#### Scenario: Чтение чужой платформы

- **WHEN** appearance есть у компонента `compose`, а запрос содержит `platform=web`
- **THEN** `ds-service` MUST ответить `404`

#### Scenario: Экспорт по платформе

- **WHEN** конфигурации есть только у компонента `compose`, а экспорт запрошен для `web`
- **THEN** пакет MUST содержать ноль конфигураций

#### Scenario: Нет компонента на платформе

- **WHEN** импорт выполняется для платформы, на которой компонента нет
- **THEN** конфигурация MUST попасть в `rejected` с причиной, содержащей платформу

### Requirement: Записи журнала без дизайн-системы не попадают в ленты

Строки `design_system_changes` с пустым `design_system_id` SHALL NOT возвращаться общими и поддизайн-системными лентами изменений `ds-service`, а их наличие MUST NOT приводить к ошибке чтения.

#### Scenario: Глобальная запись в базе

- **WHEN** в таблице есть строка журнала без дизайн-системы
- **THEN** `GET /design-system-changes` и `GET /design-system-changes/by-design-system/{id}` MUST ответить `200` и MUST NOT содержать эту строку


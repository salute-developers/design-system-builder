# design-system-model-api Specification

## Purpose
Предметный API дизайн-системы: разрешённые маршруты, DTO, платформы, права доступа и операции компонентной модели.
## Requirements
### Requirement: Project-scoped token read API

API предметной модели DS Builder SHALL предоставлять через `ds-service` чтение эталонных токенов и их значений с обязательной границей проекта и выбранной дизайн-системы.

#### Scenario: Список токенов дизайн-системы
- **WHEN** клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/tokens`
- **THEN** API MUST вернуть массив токенов из системного источника истины, сохраняя сводные поля, фильтры типа и текстового запроса и действующую необязательную пагинацию
- **AND** API MUST проверить доступность системы проекту, потребовать `tokens:read` и MUST NOT строить ответ из документации

#### Scenario: Чтение токена по стабильному идентификатору
- **WHEN** клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/tokens/{tokenId}`
- **THEN** API MUST вернуть эталонный DTO токена с типом, отображаемыми метаданными и сведениями о редакции при их наличии
- **AND** API MUST вернуть `404`, если токен не принадлежит указанной системе, даже когда обе системы доступны проекту

#### Scenario: Чтение значений токена с фильтрами
- **WHEN** клиент вызывает системный `GET /tokens/{tokenId}/values` с фильтрами темы, режима или платформы
- **THEN** API MUST вернуть DTO значений только этой системы и сохранить представленные моделью метаданные исходного, ссылочного и разрешённого значения

#### Scenario: Стабильность существующих маршрутов токенов
- **WHEN** MCP читает токен или значения по стабильному UUID
- **THEN** HTTP-адаптер MUST использовать выбранную систему в пути, а сервер MUST проверить проект, систему и `tokens:read`
- **AND** прежние `/ds/tokens/{tokenId}` и `/ds/tokens/{tokenId}/values` MUST NOT обслуживать запрос

### Requirement: Project-scoped component read API

API SHALL отделять глобальное описание компонента от конфигураций, осей, стилей и значений выбранной дизайн-системы, сохраняя проектные разрешения.

#### Scenario: Список компонентов дизайн-системы
- **WHEN** клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/components`
- **THEN** API MUST вернуть массив кратких данных, стабильные UUID и имена стилей системного источника истины с действующими фильтрами и необязательной пагинацией
- **AND** сервер MUST проверить доступ к системе и `components:read`

#### Scenario: Чтение компонента
- **WHEN** клиент вызывает `GET /api/projects/{projectId}/design-systems/catalog/components/{componentId}`
- **THEN** API MUST сохранить глобальные метаданные и прежние доступные ссылки, проверку доступности компонента проекту и ответ `404` при отсутствии доступа
- **AND** системные настройки MUST читаться отдельным системным запросом

#### Scenario: Чтение пакета конфигураций компонентов
- **WHEN** клиент вызывает системный `POST /component-config/export` без `designSystemId` в теле, с фильтрами `components` или `styles`
- **THEN** API MUST вернуть канонический пакет указанной системы с именами компонентов и стилей, применить фильтры и потребовать `components:read`

#### Scenario: Чтение одной конфигурации из пакетного контракта
- **WHEN** клиент использует пакетный контракт для одного компонента и стиля
- **THEN** HTTP-адаптер MUST вызвать системный `POST /component-config/export` с этими фильтрами
- **AND** API MUST сохранить каноническую общую конфигурацию

#### Scenario: Чтение стилей и вариаций компонента
- **WHEN** клиент вызывает системный `/components/{componentId}/styles` либо `/components/{componentId}/variations`
- **THEN** API MUST вернуть DTO только выбранной системы со стабильными идентификаторами для сопоставления с code bindings

### Requirement: No backend pagination in first read tools version

Перенос маршрутов SHALL сохранять действующую необязательную серверную пагинацию предметных списков и прежнюю форму массивов без обёртки `context/data`.

#### Scenario: Existing list shape remains array-based
- **WHEN** клиент читает токены или компоненты без параметров страницы
- **THEN** API MUST сохранить массив и существующие правила полного чтения

#### Scenario: Поддерживаемая страница
- **WHEN** клиент передаёт поддерживаемые `limit` и `cursor`
- **THEN** сервер MUST сохранить действующие ограничения, порядок и метаданные страницы, привязав курсор к системе и версии

#### Scenario: Existing component routes are stabilized
- **WHEN** реализация переиспользует существующие сценарии компонентов, стилей, вариаций или экспорта
- **THEN** глобальные детали компонента MUST использовать адрес под `catalog` без ID системы, а системные детали и агрегаты MUST использовать системный корень без отдельного сетевого запроса на каждую вариацию

### Requirement: Gateway authorization for model read API

Публичный вход SHALL авторизовать проектные запросы по общему префиксу `/api/projects/{projectId}/design-systems/...`: с ID системы для системных ресурсов и без него для глобальных. `ds-service` SHALL независимо применять доверенный проектный контекст и ожидаемую систему.

#### Scenario: Существующий маршрут Gateway передаёт разрешённый запрос
- **WHEN** аутентифицированный клиент читает системный ресурс
- **THEN** публичный вход MUST проверить доступ к проекту и сформировать доверенный контекст, а сервис MUST проверить разрешение, принадлежность ресурса проекту и системе пути

#### Scenario: Поддельные заголовки
- **WHEN** клиент передаёт собственные заголовки доверенного контекста или ожидаемой системы
- **THEN** публичный вход MUST NOT принимать их как источник разрешений или замены ID системы пути

#### Scenario: Неверный проект
- **WHEN** проектный ключ или участник не имеет доступа к проекту пути
- **THEN** запрос MUST быть отклонён до выполнения предметной операции

#### Scenario: Неавторизованный запрос отклоняется
- **WHEN** клиент вызывает чтение токена или компонента без действительной проектной аутентификации
- **THEN** публичный вход MUST отклонить запрос с `401` или `403`, а прямое обращение к `ds-service` с отсутствующим или противоречивым доверенным контекстом MUST быть отклонено
- **AND** сервис MUST NOT выводить доверенную проектную идентичность только из управляемых клиентом path или query

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

Веб-клиент SHALL использовать канонические системные URL и сохранить существующие пользовательские операции, формы DTO и предметную семантику. Старые системные адреса SHALL NOT использоваться как резервный путь.

#### Scenario: Existing web client endpoints remain compatible
- **WHEN** пользователь открывает систему, переключает тему, редактирует токены или конфигурацию
- **THEN** чтения, мутации, публикация и SSE MUST передавать выбранную систему в пути, сохраняя результаты пользовательских действий

#### Scenario: Объединённые списки
- **WHEN** веб-клиент читает токены, темы или конфигурации после объединения обработчиков
- **THEN** ответ MUST сохранить необходимые поля обычного и сводного представлений, включая группы/публикацию токенов и редакцию/preview тем

#### Scenario: Frontend Kotlin clients may migrate
- **WHEN** перенос системных маршрутов затрагивает `frontend-kt/cli` или общие клиентские сценарии
- **THEN** HTTP-адаптеры MUST переходить на канонические пути совместно с сервером
- **AND** изменение MUST сохранять документированное поведение команд CLI и форматы локальных файлов

### Requirement: Tenant token values expose palette references

`GET /tenants/:id/token-values` SHALL return a value bound to the palette as a palette reference string.

#### Scenario: Значение со ссылкой на палитру

- **WHEN** a token value has `paletteId`
- **THEN** its `value` MUST be `["[type.shade.saturation]"]`, or `["[type.shade.saturation][opacity]"]` when the stored value holds an opacity
- **THEN** values without `paletteId` MUST be returned unchanged

### Requirement: Полный разрешённый набор предметных маршрутов

`ds-service` SHALL обслуживать следующий канонический набор предметных маршрутов. `P = /api/projects/{projectId}`, `D = P/design-systems/{designSystemId}`, `G = P/design-systems/catalog`. Совпадающие после переноса строки SHALL объединяться в один обработчик. Системное обогащение свойств/зависимостей SHALL иметь отдельный путь D; базовые глобальные чтения сохраняются на G. Ранее удалённые методы SHALL NOT восстанавливаться из старого манифеста. Административный импорт API-метаданных и маршруты сборок плагинов сохраняют существующую отдельную регистрацию и разрешения.

#### Scenario: Полный перечень маршрутов по ресурсам

- **WHEN** проверяется соответствие предметного API разрешённому набору маршрутов
- **THEN** набор MUST соответствовать следующей канонической таблице

| Методы | Канонический публичный путь |
|---|---|
| GET, POST | P/design-systems |
| GET, PATCH, DELETE | D |
| GET | D/components |
| GET | D/token-groups |
| GET | D/tokens |
| GET | D/components/{componentId}/styles |
| GET | D/components/{componentId}/editor-bundle |
| GET | D/tenants |
| GET | D/appearances |
| GET | D/changes/summary |
| GET | D/changes/token-ids |
| GET | D/changes |
| GET, POST | D/versions |
| GET | D/versions/{id} |
| GET | D/versions (объединить список) |
| GET, POST | D/tenants |
| GET, PATCH, DELETE | D/tenants/{id} |
| GET, PUT | D/tenants/{id}/token-values |
| GET | D/tenants/{tenantId}/palette |
| GET | D/tenants/{tenantId}/palette/links |
| POST | D/tenants/{tenantId}/palette/groups |
| PATCH, DELETE | D/tenants/{tenantId}/palette/groups/{groupId} |
| PUT | D/tenants/{tenantId}/palette/token-groups/{tokenId} |
| POST | D/tenants/{tenantId}/palette/groups/{groupId}/ramps |
| DELETE | D/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade} |
| PUT | D/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/source |
| POST | D/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/rebuild |
| PATCH | D/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/steps/{step} |
| POST | D/tenants/{tenantId}/color-tokens |
| PUT | D/tenants/{tenantId}/color-tokens/{tokenId}/values |
| DELETE | D/tenants/{tenantId}/color-tokens/{tokenId} |
| POST | D/tenants/{tenantId}/color-tokens/{tokenId}/move |
| POST | D/tenants/{tenantId}/token-groups |
| PATCH, DELETE | D/tenants/{tenantId}/token-groups/{groupId} |
| GET, POST | D/tenants/{tenantId}/typography-styles |
| PATCH, DELETE | D/tenants/{tenantId}/typography-styles/{tokenId} |
| PATCH | D/tenants/{tenantId}/typography-styles/{tokenId}/name |
| PATCH, DELETE | D/tenants/{tenantId}/typography-groups/{group} |
| GET, POST | D/tenants/{tenantId}/size-tokens |
| PUT | D/tenants/{tenantId}/size-tokens/{tokenId}/value |
| DELETE, PATCH | D/tenants/{tenantId}/size-tokens/{tokenId} |
| GET, POST | D/tokens |
| GET, PATCH, DELETE | D/tokens/{id} |
| GET | D/tokens/{id}/values |
| GET, POST | D/token-values |
| GET, PATCH, DELETE | D/token-values/{id} |
| GET, POST | G/palette |
| GET, PATCH, DELETE | G/palette/{id} |
| GET | G/palette/by-type/{type} |
| GET | G/compose-preview/plugin |
| GET | G/web-preview/plugin |
| GET, POST | G/components |
| GET, PATCH | G/components/{id} |
| GET | D/components/{id}/variations |
| GET | G/components/{id}/properties; D/components/{id}/properties для обогащения |
| GET | G/components/{id}/deps; D/components/{id}/deps для обогащения |
| GET, POST | D/design-system-components |
| GET, DELETE | D/design-system-components/{id} |
| GET, POST | G/component-deps |
| GET, PATCH | G/component-deps/{id} |
| GET, POST | D/component-reuse-configs |
| GET, PATCH, DELETE | D/component-reuse-configs/{id} |
| GET | D/component-reuse-configs/by-dep/{componentDepId} |
| GET, POST | D/variations |
| GET, PATCH | D/variations/{id} |
| GET | D/variations/{id}/styles |
| GET | D/variations/{id}/properties |
| GET, POST | G/properties |
| GET, PATCH | G/properties/{id} |
| GET, POST | G/property-platform-params |
| GET, PATCH | G/property-platform-params/{id} |
| GET, POST | D/property-variations |
| GET | D/property-variations/{id} |
| GET, POST | D/variation-platform-param-adjustments |
| GET, PATCH, DELETE | D/variation-platform-param-adjustments/{id} |
| GET, POST | D/invariant-platform-param-adjustments |
| GET, PATCH, DELETE | D/invariant-platform-param-adjustments/{id} |
| GET, POST | D/appearances |
| GET, PATCH, DELETE | D/appearances/{id} |
| GET | D/appearances/{id}/variations |
| GET | D/appearances/{id}/editor-model |
| GET | D/appearances/{id}/resolved-properties |
| GET | D/appearances/{id}/token-references |
| POST | D/appearances/{id}/axes |
| DELETE | D/appearances/{id}/axes/{axisId} |
| POST | D/appearances/{id}/axis-order |
| POST | D/appearances/{id}/axes/{axisId}/values |
| DELETE | D/appearances/{id}/axis-values/{valueId} |
| PUT | D/appearances/{id}/axes/{axisId}/value-order |
| PUT, DELETE | D/appearances/{id}/property-values |
| PUT | D/appearances/{id}/state-order |
| POST | D/appearances/new |
| POST | D/appearances/{id}/duplicate |
| GET, POST | D/appearance-variations |
| GET, PATCH, DELETE | D/appearance-variations/{id} |
| GET, POST | D/appearance-variation-values |
| GET, PATCH, DELETE | D/appearance-variation-values/{id} |
| GET, POST | D/styles |
| GET, PATCH, DELETE | D/styles/{id} |
| GET | D/styles/by-variation/{variationId} |
| GET, POST | D/variation-property-values |
| GET, PATCH, DELETE | D/variation-property-values/{id} |
| GET | D/variation-property-values/by-style/{styleId} |
| GET | D/variation-property-values/by-appearance/{appearanceId} |
| GET, POST | D/invariant-property-values |
| GET, PATCH, DELETE | D/invariant-property-values/{id} |
| GET | D/invariant-property-values/by-component/{componentId} |
| GET, POST | G/states |
| GET, PATCH | G/states/{id} |
| GET | G/states/{id}/impact |
| GET | G/state-sets |
| GET | G/state-sets/{id} |
| POST | G/state-sets/resolve |
| GET, POST | D/style-combinations |
| GET, PATCH, DELETE | D/style-combinations/{id} |
| GET, POST | D/style-combinations/{id}/members |
| GET, POST | D/style-combination-members |
| GET, DELETE | D/style-combination-members/{id} |
| GET | D/component-config |
| POST | D/component-config/import |
| POST | D/component-config/export |
| POST | D/component-config/web-adapter |
| POST | D/changes/revert |
| POST | D/changes/{changeId}/revert |
| GET | D/events |

#### Scenario: Проверка route manifest

- **WHEN** контрактный тест перечисляет предметные методы и пути
- **THEN** зарегистрированные маршруты MUST совпасть с каноническим набором, OpenAPI и манифестом; дубли MUST отсутствовать

#### Scenario: Доступ через внешний и внутренний префиксы

- **WHEN** системный метод вызывается публично через D либо через самостоятельный `/api/design-systems/{designSystemId}`
- **THEN** сервис MUST применить одинаковую границу системы и DTO; внутренние глобальные маршруты MUST использовать `/api/design-systems/catalog/{resource}`, административные — `/api/admin/...`, без регистрации или нормализации через `/api/ds`
- **AND** детали внутреннего пути MUST NOT попадать в публичный DTO

### Requirement: Исключённые маршруты не входят в Kotlin-сервис

`ds-service` MUST NOT реализовывать маршруты `documentation-pages`, `saved-queries`, `/legacy/**`, а также операции генерации артефактов. Административный импорт API-меты в глобальный слой компонентов выполняется в `ds-service` под внутренним путём `/api/admin/component-config/import-api-meta`; отдельные административные маршруты сборок плагинов сохраняют существующий контракт. Произвольные административные запросы к таблицам или схеме SHALL NOT предоставляться.

#### Scenario: Исключённые области маршрутизации

- **WHEN** проверяется отсутствие исключённых маршрутов в предметном API
- **THEN** перечень исключённых маршрутов MUST соответствовать следующей таблице

| Исключённая область | Маршруты, от которых отказывается `ds-service` |
|---|---|
| Документация | `GET /documentation-pages`, `GET /documentation-pages/{id}`, `GET /documentation-pages/by-design-system/{designSystemId}`, `POST /documentation-pages`, `PATCH /documentation-pages/{id}`, `DELETE /documentation-pages/{id}` |
| Сохранённые запросы | `GET /saved-queries`, `GET /saved-queries/{id}`, `POST /saved-queries`, `PATCH /saved-queries/{id}`, `DELETE /saved-queries/{id}`, `GET /saved-queries/{id}/run` |
| Legacy (удалены вместе с db-service) | `GET /legacy/design-systems/{name}/component-configs`, `GET /legacy/design-systems/{name}/theme-data`, `GET /legacy/design-systems/{name}/tenant-params`, `POST /legacy/design-systems/create`, `POST /legacy/design-systems/{name}/update`, `GET /legacy/design-systems/{name}/download-theme` |

Отдельных смонтированных маршрутов генерации в текущем предметном router нет; `download-theme` считается legacy-операцией и исключён явно.

#### Scenario: Запрос исключённого маршрута напрямую в ds-service

- **WHEN** запрос приходит в `ds-service` по исключённому пути
- **THEN** сервис MUST вернуть `404 Not Found`
- **AND** OpenAPI `ds-service` MUST NOT описывать этот путь

#### Scenario: Совместное существование с db-service

- **WHEN** исключённый маршрут требуется существующему потребителю
- **THEN** Gateway MUST ответить `404`: upstream db-service удалён, более специфичной маршрутизации исключённых путей нет
- **AND** это MUST NOT добавлять исключённый маршрут в контракт `ds-service`

#### Scenario: Административные маршруты db-service удалены

- **WHEN** клиент вызывает `GET /api/admin/tables`, `GET /api/admin/queries`, `GET /api/admin/schema` или любой путь `/api/projects/{projectId}/ds/legacy/**` через Gateway
- **THEN** Gateway MUST ответить `404` и MUST NOT содержать для них upstream

### Requirement: Совместимость перенесённого API

Каждый перенесённый маршрут SHALL сохранять наблюдаемый контракт прежнего `db-service`, зафиксированный в OpenAPI `ds-service`: имена и обязательность path/query/body полей, форму JSON, семантику `null` и отсутствующих полей, коды успешных ответов, предметные ошибки, порядок элементов там, где он стабилен, и транзакционные границы. Исключения, согласованные в `design-system-request-scope`: канонические системные/глобальные пути, удаление дублирующего `designSystemId` из входных HTTP DTO/query и единые списки токенов и тем. Эти изменения SHALL NOT трактоваться как нарушение совместимости переноса; остальные поля и предметная семантика SHALL сохраняться.

#### Scenario: Сравнение чтения двух реализаций

- **WHEN** `ds-service` получает запрос чтения перенесённого маршрута
- **THEN** статус и JSON-ответ MUST соответствовать OpenAPI `ds-service`; второй реализации для сравнения нет

#### Scenario: Сравнение мутации двух реализаций

- **WHEN** допустимая мутация выполняется в `ds-service`
- **THEN** ответ и итоговое состояние предметных таблиц MUST соответствовать документированным транзакционным границам

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

`ds-service` SHALL сохранять контракт тем, унаследованный от прежнего `db-service`: `POST /tenants` принимает `profile` (`sber`, `malachite`, `b2b` или `custom`) и для `custom` обязательный `customPalette`; ответы `Tenant` содержат `editRevision` и `preview`; список тем и агрегаты дизайн-систем SHALL возвращать вычисленные preview без раскрытия внутренних данных токенов.

#### Scenario: Создание темы с профилем

- **WHEN** principal с `tenants:write` создаёт тему доступной дизайн-системы с валидным профилем
- **THEN** `ds-service` MUST нормализовать имя и создать тему с `editRevision = 0`
- **AND** MUST создать начальные значения токенов в той же транзакционной границе
- **AND** ответ MUST соответствовать DTO `Tenant` из OpenAPI `ds-service`

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

`GET /component-config` SHALL требовать query-параметр `platform`, а `POST /component-config/import` и `POST /component-config/export` — поле тела `platform`; без платформы или со значением вне словаря `ds-service` MUST отвечать `400`.

#### Scenario: Выбор платформенных данных конфигурации

- **WHEN** запрос component-config задаёт допустимую платформу
- **THEN** Компонент MUST выбираться только среди компонентов этой платформы, экспорт MUST отдавать конфигурации только компонентов этой платформы, а конфигурация без компонента на платформе импорта MUST отклоняться с причиной, называющей платформу. Запись журнала `components:import` MUST содержать `platform`.

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
- **THEN** системный `GET /api/design-systems/{designSystemId}/changes` MUST ответить `200` и MUST NOT содержать эту строку

### Requirement: Административный импорт API-меты в ds-service

`ds-service` SHALL предоставлять административный маршрут `POST /api/admin/component-config/import-api-meta`, который Gateway публикует как `POST /api/admin/component-config/import-api-meta`.

#### Scenario: Доверенный административный импорт

- **WHEN** вызывается административный маршрут импорта API-меты
- **THEN** Маршрут MUST быть доступен только доверенному системному администратору, принимать манифест API-меты одним запросом (до 16 MiB), выполнять запись аддитивно в одной транзакции и писать в журнал `design_system_changes` строку с `design_system_id = NULL`. Маршрут не входит в проектный префикс `/api/projects/{projectId}/design-systems`, не описывается в OpenAPI проектных маршрутов и не требует идентификатора дизайн-системы.

#### Scenario: Системный администратор импортирует мету

- **WHEN** системный администратор отправляет манифест на `POST /api/admin/component-config/import-api-meta`
- **THEN** Gateway MUST передать запрос в `ds-service` на `/api/admin/component-config/import-api-meta`
- **AND** `ds-service` MUST вернуть отчёт импорта с теми же полями, что и прежняя реализация в `db-service`

#### Scenario: Пользователь без роли и прямой вызов

- **WHEN** запрос приходит без `X-System-Admin: true`
- **THEN** `ds-service` MUST ответить `403` до разбора тела и MUST NOT изменить данные

#### Scenario: Роль и права ключа проекта

- **WHEN** запрос на административный маршрут приходит с ключом проекта
- **THEN** Gateway MUST ответить `401` и MUST NOT передавать запрос в `ds-service`

### Requirement: ds-service обслуживает web-адаптер

`ds-service` SHALL обслуживать `POST /api/design-systems/{designSystemId}/component-config/web-adapter` с телом `{}` и дизайн-системой из пути
и возвращать JSON-массив по контракту требования `Web adapter endpoint` из `cli-components`: по одной записи на
компонент, у которого в дизайн-системе есть конфигурация, с полями `componentName`, `name` и необязательными
`description`, `compose`, `styles`. Необязательное поле без данных MUST отсутствовать в ответе, а не равняться `null`.

#### Scenario: Ответ совпадает с эталонной реализацией

- **GIVEN** одна и та же база с конфигурациями компонентов, шаблонами web-параметров и compose-связями
- **WHEN** клиент с permission `components:read` запрашивает web-адаптер доступной дизайн-системы у `ds-service`
- **THEN** сервис MUST вернуть `200` и массив с записями по контракту `Web adapter endpoint`
- **AND** `componentName` MUST быть именем компонента в написании `meta.json`, а `name` — именем из базы

#### Scenario: Шаблоны собираются по стилям

- **WHEN** у значения конфигурации есть поправка web-параметра с шаблоном
- **THEN** `styles.<styleName>.templates` MUST сопоставлять имя свойства с именем параметра и шаблоном
- **AND** стиль без шаблонов MUST отсутствовать в `styles`
- **AND** при расходящихся шаблонах одной пары свойства и параметра внутри стиля MUST выбираться наименьший по строковому сравнению

#### Scenario: Compose-связи только между компонентами пакета

- **WHEN** у компонентов дизайн-системы есть зависимости типа `compose`
- **THEN** `compose` родителя MUST перечислять детей в порядке связи
- **AND** ребёнок без конфигурации в этой дизайн-системе и зависимости типа `reuse` MUST отсутствовать

#### Scenario: Дизайн-система без конфигураций

- **WHEN** у доступной дизайн-системы нет ни одной конфигурации компонента
- **THEN** сервис MUST вернуть `200` и пустой массив

#### Scenario: Повторный запрос не даёт расхождений

- **WHEN** клиент дважды запрашивает web-адаптер без изменения данных
- **THEN** оба ответа MUST совпадать побайтно: записи упорядочены по `componentName`, ключи `styles` и `templates` — по имени

#### Scenario: Недостаточно прав или чужая дизайн-система

- **WHEN** у субъекта запроса нет permission `components:read`
- **THEN** сервис MUST вернуть `403` и MUST NOT читать данные дизайн-системы
- **WHEN** `designSystemId` принадлежит другому проекту или не существует
- **THEN** сервис MUST вернуть `404` без признаков существования чужой дизайн-системы

#### Scenario: Некорректное тело запроса

- **WHEN** `designSystemId` отсутствует или не является UUID
- **THEN** сервис MUST вернуть `400` и MUST NOT обращаться к базе

### Requirement: Выгрузка компонентов ds-service восстанавливает смещения

`POST /api/design-systems/{designSystemId}/component-config/export` в `ds-service` SHALL возвращать `adjustment` значения из поправок
платформенных параметров, когда у строки значения собственное смещение не задано, по правилам требования
`Export restores offsets from platform parameter adjustments` из `cli-components`.

#### Scenario: Смещение берётся из поправки

- **WHEN** у строки значения нет `adjustment`, но есть числовая поправка платформенного параметра, отличная от значения строки
- **THEN** выгрузка MUST вернуть эту поправку как `adjustment`
- **AND** при разных поправках по платформам MUST выбираться web, затем xml, compose, ios

#### Scenario: Собственное смещение строки имеет приоритет

- **WHEN** у строки значения задан `adjustment` и есть числовая поправка платформенного параметра
- **THEN** выгрузка MUST вернуть `adjustment` строки

#### Scenario: Нечисловая поправка и копия значения не считаются смещением

- **WHEN** поправка не является числом, пуста либо совпадает со значением строки или именем её токена
- **THEN** выгрузка MUST NOT подставлять её в `adjustment`

#### Scenario: Чтение одного конфига не меняется

- **WHEN** клиент читает `GET /api/design-systems/{designSystemId}/component-config`
- **THEN** ответ MUST формироваться как до изменения, без подстановки смещений из поправок

### Requirement: Снимок конфигураций компонентов согласован с глобальными свойствами

Снимок конфигураций компонентов `ds-service` SHALL ссылаться на свойства по именам, принятым в глобальном слое
метаданных после PLASMABLDR-186, и MUST NOT ссылаться на свойства, удалённые из prod-сидов как не имеющие web-параметра.

#### Scenario: Свойство разделителя списка

- **WHEN** загружается снимок `component-seeds.json`
- **THEN** компонент `List` MUST ссылаться на свойство `listItemDividerHeight`
- **AND** имя `listItemDividerWidth` MUST отсутствовать в снимке

#### Scenario: Инициализация на актуальных метаданных

- **GIVEN** глобальные метаданные содержат свойство `List.listItemDividerHeight` и не содержат `listItemDividerWidth`
- **WHEN** проверяется полнота метаданных перед инициализацией конфигураций компонентов
- **THEN** свойство разделителя списка MUST NOT попадать в число отсутствующих метаданных

#### Scenario: Свойства без web-параметра отсутствуют в снимке

- **WHEN** загружается снимок `component-seeds.json`
- **THEN** компоненты `Button`, `Checkbox`, `IconButton` и `Radiobox` MUST NOT ссылаться на свойства, удалённые из prod-сидов (например, `Button.iconColor`, `IconButton.paddingEnd`)
- **AND** инициализация на метаданных чистого prod-сида MUST NOT находить отсутствующих свойств

### Requirement: Предметное чтение поддерживает временную границу дизайн-системы

Методы чтения модели в `backend-kt/ds-service` SHALL принимать необязательный `versionId` для данных, принадлежащих
конкретной дизайн-системе, и SHALL сохранять существующее чтение активного состояния при отсутствии параметра.

#### Scenario: Клиент читает актуальную модель

- **WHEN** клиент вызывает список токенов, значения tenant, конфигурацию appearance, варианты или стили без
  `versionId`
- **THEN** API MUST вернуть разрешённое состояние активного черновика
- **THEN** ответ MUST сохранять документированную предметную форму DTO

#### Scenario: Клиент читает опубликованную модель

- **WHEN** клиент вызывает поддерживаемый предметный метод с `versionId` опубликованной версии
- **THEN** API MUST вернуть разрешённое состояние на границе этой версии
- **THEN** API MUST применить те же проверки проекта и прав, что и для актуального состояния

#### Scenario: Клиент передал недоступную версию

- **WHEN** версия отсутствует, принадлежит другой дизайн-системе или недоступна доверенному проекту
- **THEN** API MUST вернуть `404 Not Found`
- **THEN** ответ MUST NOT раскрывать наличие данных другого проекта

### Requirement: Общая модель компонента не входит в версии дизайн-системы

API SHALL версионировать только данные компонента, принадлежащие конкретной дизайн-системе, и SHALL читать общие
описания компонента, его платформу, свойства, состояния и признаки устаревания платформенных имён независимо от
`versionId`. Общие сущности SHALL NOT удаляться через публичный API, а ссылки конфигурации дизайн-системы и её истории
на них MUST запрещать физическое удаление.

#### Scenario: Клиент читает компонент опубликованной версии новой модели

- **WHEN** запрос содержит `versionId`
- **THEN** API MUST применить временную границу к `design_system_components`, `appearances`, `styles` и связанным
  таблицам значений, комбинаций, поправок и ссылок конфигурации компонента
- **THEN** API MUST использовать актуальное общее описание API компонента, его свойств и состояний

#### Scenario: Старую версию читают после изменения общего каталога

- **WHEN** общее описание компонента или признак устаревания платформенного имени изменён после публикации версии
- **THEN** чтение опубликованной версии MUST использовать актуальное общее описание и признак устаревания
- **THEN** журнал дизайн-системы MUST NOT содержать это изменение общего каталога

#### Scenario: Клиент пытается удалить общую сущность

- **WHEN** клиент вызывает прежний публичный `DELETE` компонента, зависимости, свойства, вариации, платформенного
  имени, связи свойства с вариацией или состояния
- **THEN** API MUST ответить `404 Not Found` или `405 Method Not Allowed`
- **THEN** активные и исторические данные дизайн-систем MUST остаться без изменений

#### Scenario: Служебная очистка встретила зависимость

- **WHEN** служебная операция пытается физически удалить общую сущность, на которую ссылается активная или
  историческая конфигурация дизайн-системы
- **THEN** PostgreSQL MUST отклонить удаление ограничением внешнего ключа `RESTRICT`

### Requirement: Маршруты операций редактора оформления входят в разрешённый набор

Операции редактора оформления SHALL входить в разрешённый набор предметного API по приведённому ниже перечню.

#### Scenario: Полный перечень операций редактора

- **WHEN** проверяется разрешённый набор маршрутов редактора оформления
- **THEN** Перечень предметных маршрутов `ds-service` SHALL быть дополнен маршрутами операций редактора оформления (относительно `P = /api/projects/{projectId}/design-systems/{designSystemId}`): `GET /appearances/{id}/editor-model`, `POST /appearances/{id}/axes`, `DELETE /appearances/{id}/axes/{axisId}`, `POST /appearances/{id}/axis-order`, `POST /appearances/{id}/axes/{axisId}/values`, `DELETE /appearances/{id}/axis-values/{valueId}`, `PUT /appearances/{id}/axes/{axisId}/value-order`, `PUT /appearances/{id}/property-values`, `DELETE /appearances/{id}/property-values` (область в параметрах запроса `propertyId`, `styleIds`, `states`), `PUT /appearances/{id}/state-order`, `POST /appearances/new`, `POST /appearances/{id}/duplicate`. Эти маршруты MUST NOT считаться предметными маршрутами вне набора, запрещёнными требованием «Полный разрешённый набор предметных маршрутов»: их добавление выполняется этим OpenSpec-изменением.

#### Scenario: Проверка route manifest

- **WHEN** контрактный тест перечисляет маршруты `ds-service`
- **THEN** каждый маршрут операций редактора MUST существовать с указанным HTTP-методом
- **THEN** каждый такой маршрут MUST быть описан в `documentation.yaml`, манифесте маршрутов и аудите потребителей

#### Scenario: Доступ через внешний и внутренний префиксы

- **WHEN** клиент вызывает операцию редактора через `P`
- **THEN** Gateway MUST передать тот же остаток пути в `ds-service` под `/api/design-systems/{designSystemId}`

### Requirement: Вариации ограничены дизайн-системой

Чтение и изменение осей SHALL выполняться внутри обязательного системного пути; вариация SHALL сохранять `designSystemId` в DTO ответа; во входном DTO дублирующего поля SHALL NOT быть. Глобальное определение компонента SHALL NOT приобретать единственного владельца-дизайн-систему.

#### Scenario: Чтение с фильтром
- **WHEN** клиент читает системный `GET /components/{id}/variations`
- **THEN** API MUST вернуть массив осей только системы пути

#### Scenario: Чтение без фильтра
- **WHEN** клиент вызывает прежние `/ds/variations` или `/ds/components/{id}/variations`
- **THEN** API MUST вернуть `404`, не перечисляя оси всех доступных систем

#### Scenario: Создание оси без дублирования системы
- **WHEN** клиент создаёт ось по системному пути с допустимыми данными без `designSystemId` в теле
- **THEN** API MUST использовать систему пути и MUST NOT требовать её дублирования в теле

#### Scenario: Создание оси в чужой системе
- **WHEN** система пути недоступна вызывающему на запись
- **THEN** API MUST отклонить запрос прежней ошибкой авторизации/принадлежности и MUST NOT создать ось

#### Scenario: Создание оси без системы
- **WHEN** клиент вызывает прежний `POST /api/ds/variations` без системы в пути
- **THEN** API MUST вернуть `404` и MUST NOT создавать ось или выбирать систему из тела запроса

### Requirement: Ссылки компонентов на токены переживают переименование

Значения свойств компонентов, ссылающиеся на токен, SHALL хранить ссылку через `token_id` без копии имени в `value`. Сборка конфигурации компонентов SHALL брать имя токена по `token_id`.

#### Scenario: Запись значения со ссылкой на токен

- **WHEN** `ds-service` записывает значение свойства компонента со ссылкой на токен — импортом конфигурации, созданием или изменением значения через API или сидом
- **THEN** строка значения MUST содержать `token_id` и `value = null`

#### Scenario: Строка с токеном и текстом

- **WHEN** сборка конфигурации в `ds-service` встречает строку, где заданы и `token_id`, и `value`
- **THEN** в конфигурации MUST быть имя токена по `token_id`

#### Scenario: Компонент после переименования токена

- **WHEN** токен `text.default.accent`, на который ссылается стиль компонента, переименован в `text.default.brand`
- **THEN** `GET component-configs` в `ds-service` MUST вернуть в этом свойстве `text.default.brand`

#### Scenario: Миграция дублей имени

- **WHEN** миграция обрабатывает строку значения компонента, где `token_id` задан, а `value` равен имени этого токена
- **THEN** `value` MUST стать `null`, а строки без `token_id` MUST NOT измениться

### Requirement: Совместимый серверный выбор номера версии

Чтения версионированной модели SHALL принимать version=draft либо точный major.minor.patch и сохранять versionId. Сервер SHALL разрешать номер внутри доступной DS ресурса через существующие связи и проверки доступа. Чтение глобальной меты компонента SHALL сохранять прежний контракт без обещания снимка DS.

#### Scenario: Явная публикация

- **WHEN** клиент передаёт version существующей публикации
- **THEN** данные MUST соответствовать её временной границе без клиентского поиска UUID
- **THEN** неизвестная, чужая либо архивная snapshot-версия MUST вернуть NOT_FOUND без перехода на черновик

#### Scenario: Черновик и конфликт селекторов

- **WHEN** оба селектора отсутствуют либо version равен draft
- **THEN** сервер MUST читать текущий черновик
- **WHEN** переданы одновременно version и versionId либо повтор одного селектора
- **THEN** сервер MUST вернуть INVALID_QUERY

#### Scenario: Существующая авторизация

- **WHEN** ресурс читается по ID
- **THEN** сервер MUST переиспользовать проверки доступа и связей ресурса
- **THEN** запрос MUST NOT требовать нового обязательного designSystemId лишь для подтверждения локального контекста MCP

### Requirement: Чтение вариаций существующей конфигурации

GET /api/design-systems/{designSystemId}/appearances/{id}/variations SHALL использовать существующее версионирование конфигурации и сохранять прежний массив осей со значениями и defaults. Общие version и X-DS-Read-Context SHALL применяться к фактической DS appearance без новой модели хранения или серверной проекции.

#### Scenario: Адрес конфигурации определяет DS

- **WHEN** передан appearanceId и необязательный version либо versionId
- **THEN** сервер MUST определить DS по существующей связи appearance и проверить доступ к ресурсу
- **THEN** выбор версии, проверка существования конфигурации на границе, чтение осей и метаданных MUST выполняться в одной read-only транзакции
- **THEN** запрос MUST NOT требовать нового обязательного designSystemId или выбирать конфигурацию по глобальному componentId

#### Scenario: Исторические оси и значения

- **WHEN** оси, значения или defaultStyleId конфигурации различаются между публикацией и draft
- **THEN** ответ MUST содержать существующие поля осей, values и defaultStyleId выбранной границы без перехода на текущее состояние
- **THEN** прежнее тело MUST сохраняться без include=values,defaults и без новой обёртки
- **THEN** X-DS-Read-Context MUST относиться к той же границе и фактической DS appearance

#### Scenario: Отсутствующая конфигурация и пустые оси

- **WHEN** appearanceId неизвестен, недоступен, отсутствует на выбранной границе либо versionId относится к другой DS
- **THEN** сервер MUST вернуть NOT_FOUND без перехода на draft
- **WHEN** доступная конфигурация существует на выбранной границе, но не содержит осей
- **THEN** сервер MUST вернуть пустой массив

#### Scenario: Существующие маршруты сохраняются

- **WHEN** применяется этот Change
- **THEN** GET /components/{id} MUST сохранить прежнее тело меты без добавления списка конфигураций
- **THEN** удаление или изменение GET /components/{id}/variations MUST NOT входить в этот Change

### Requirement: Метаданные фактического чтения вне тела

Расширенные чтения SHALL передавать безопасный X-DS-Read-Context в HTTP-заголовке, сохраняя прежние тела ответов. Контекст и данные MUST соответствовать одной транзакции.

#### Scenario: Черновик изменяется конкурентно

- **WHEN** сервер возвращает данные черновика
- **THEN** заголовок MUST содержать designSystemId, version=draft, draftId и draftRevision фактического чтения
- **THEN** независимое изменение после чтения MUST NOT требовать expectedDraftRevision или приводить к DRAFT_CHANGED

#### Scenario: Публикация или история

- **WHEN** читается одна публикация
- **THEN** заголовок MUST содержать designSystemId, version и versionId
- **WHEN** читается история разных публикаций
- **THEN** контекст MUST NOT приписывать списку одну выбранную версию

#### Scenario: Прежний потребитель

- **WHEN** клиент игнорирует новые заголовки
- **THEN** он MUST получить прежний массив или объект без обёртки context/data
- **THEN** запрос MUST NOT требовать view, отдельного /page или предварительного read-context

#### Scenario: Безопасные заголовки доступны клиенту

- **WHEN** запрос проходит через Gateway
- **THEN** X-DS-Read-Context, X-DS-Page-Limit и X-DS-Next-Cursor MUST быть доступны через CORS
- **THEN** эти метаданные MUST NOT содержать credentials, внутренние URL или локальные пути

### Requirement: Необязательная пагинация существующих списков

Списки версий, журнала, tenants, tokens, components, styles и token-groups SHALL поддерживать необязательные limit/cursor без смены массива в теле. Без обоих параметров SHALL сохраняться полная выдача.

#### Scenario: Первая страница и продолжение

- **WHEN** клиент явно передал limit 1..200
- **THEN** сервер MUST вернуть не более limit элементов со статусом 200 и X-DS-Page-Limit
- **THEN** X-DS-Next-Cursor MUST присутствовать только при наличии продолжения
- **WHEN** передан cursor без limit
- **THEN** размер страницы MUST быть 50

#### Scenario: Неверный лимит или выборка

- **WHEN** limit нецелый, неположительный, больше 200 либо cursor относится к другому проекту, списку, DS, границе версии, фильтрам или порядку
- **THEN** сервер MUST вернуть INVALID_QUERY
- **WHEN** меняется только допустимый размер страницы
- **THEN** продолжение MUST оставаться допустимым

#### Scenario: Изменение черновика

- **WHEN** draftRevision меняется между страницами
- **THEN** продолжение MUST NOT обещать неизменный снимок или автоматически отклоняться только из-за новой revision
- **THEN** удаление последнего элемента предыдущей страницы MUST NOT само по себе делать cursor неверным
- **WHEN** публикация сменила активный draftId
- **THEN** старый cursor черновика MUST вернуть INVALID_QUERY

#### Scenario: Полная загрузка CLI

- **WHEN** theme fetch или components fetch загружает более 200 токенов/компонентов либо 50 тем
- **THEN** операция MUST сохранить полный набор и прежние форматы файлов
- **THEN** полный component-config/export MUST NOT получать ограничение списка

### Requirement: Серверные фильтры простых чтений

API SHALL выполнять фильтры до ограничения страницы: name/query, platform компонентов, type/groupId токенов, parentId групп и groupId/type/shade палитры. Порядок SHALL быть детерминированным с ID как дополнительным ключом.

#### Scenario: Точное имя и поиск

- **WHEN** передан name
- **THEN** сравнение MUST быть точным
- **WHEN** name и query переданы вместе
- **THEN** сервер MUST вернуть INVALID_QUERY

#### Scenario: Группы и палитра

- **WHEN** указан parentId
- **THEN** список MUST вернуть непосредственных детей, а без parentId — все узлы с их parentId
- **WHEN** передан shade без type
- **THEN** палитра MUST вернуть INVALID_QUERY

#### Scenario: Версии и журнал

- **WHEN** запрашиваются публикации DS
- **THEN** список MUST содержать публикации новой модели в порядке sequenceNumber DESC со стабильным ID
- **WHEN** указан точный version
- **THEN** фильтр MUST применяться сервером без загрузки каталога клиентом
- **WHEN** журнал превышает существующий поддержанный предел
- **THEN** API MUST сохранить явную ошибку вместо успешной неполной выдачи

#### Scenario: Сохранение платформ

- **WHEN** читаются токены или компоненты
- **THEN** платформы MUST остаться соответственно web/android/ios и web/compose/xml/ios
- **THEN** отсутствие tenant/platform/mode MUST NOT выбирать значение неявно

### Requirement: Адресное чтение конфигураций и параметров

API SHALL предоставлять список конфигураций по designSystemId и componentId и составное чтение параметров по appearanceId и ID выбранных значений осей. Проверка ID, выбор версии и расчёт SHALL выполняться на сервере в одной согласованной read-only транзакции выбранной версии. Существующий экспортный пакет SHALL сохраняться для генераторов без новых параметров.

#### Scenario: Прежний полный экспорт

- **WHEN** клиент передал designSystemId в системном пути, platform и необязательные components/styles в теле без дублирующего designSystemId
- **THEN** API MUST вернуть прежний полный пакет meta/components/underivedTypes без лимита списка и новой обёртки

#### Scenario: Список конфигураций

- **WHEN** клиент запрашивает GET /appearances с componentId и доступной designSystemId
- **THEN** сервер MUST вернуть appearanceId, имя и признак конфигурации по умолчанию для каждой записи с серверной пагинацией
- **THEN** результат MUST NOT подменяться списком стилей каталога
- **WHEN** клиент запрашивает GET /appearances без фильтров
- **THEN** сервер MUST сохранить прежний массив appearances

#### Scenario: ID значений и приоритет осей

- **WHEN** переданы appearanceId и selectedValueIds выбранных значений разных осей этого оформления
- **THEN** сервер MUST применить базовые свойства, затем записи выбранных осей по возрастанию position и применимые записи сочетаний
- **THEN** значение более поздней оси MUST переопределить значение более ранней для того же propertyId и набора состояний
- **THEN** ответ MUST содержать итоговые значения и ID/технические редакции записей-источников
- **WHEN** selectedValueIds отсутствует или пуст
- **THEN** сервер MUST вернуть только базовые свойства оформления

#### Scenario: Приоритет сочетаний

- **WHEN** выбранные значения делают применимой запись сочетания осей
- **THEN** сервер MUST применить её на position последней участвующей оси после одиночной записи этой оси
- **WHEN** несколько сочетаний применимы на одной position
- **THEN** более конкретное сочетание MUST иметь приоритет; при равной длине MUST побеждать сочетание с более поздней различающейся осью

#### Scenario: Неверный выбор

- **WHEN** ID значения неизвестен, принадлежит другому оформлению или выбран вместе с другим значением той же оси
- **THEN** сервер MUST вернуть INVALID_QUERY без сопоставления по имени
- **WHEN** appearanceId отсутствует на выбранной границе версии либо недоступен
- **THEN** сервер MUST вернуть NOT_FOUND без перехода на draft

#### Scenario: Конкурентная запись

- **WHEN** черновик меняется во время сборки
- **THEN** конфигурация и метаданные X-DS-Read-Context MUST относиться к одному согласованному состоянию
- **THEN** операция MUST NOT записывать изменения в БД

### Requirement: Чтение проверенных токен-ссылок компонента

API SHALL предоставлять новую операцию по appearanceId и полному набору selectedValueIds, возвращающую проверенные tokenId, имена и пути использования в выбранной версии.

#### Scenario: Полный выбор

- **WHEN** определено по одному значению каждой оси выбранного оформления
- **THEN** сервер MUST проверить ссылки по каталогу той же версии и вернуть стабильные ID и места использования
- **THEN** сервер MUST использовать итоговые значения после применения приоритета осей и сочетаний
- **THEN** результат MUST NOT вычислять значения темы или объявлять произвольные строки конфигурации токенами

#### Scenario: Неполный или недоступный выбор

- **WHEN** хотя бы одна объявленная ось не выбрана
- **THEN** сервер MUST вернуть INVALID_QUERY с безопасным описанием отсутствующего выбора
- **WHEN** оформление недоступно на выбранной версии
- **THEN** сервер MUST вернуть NOT_FOUND без утечки данных

### Requirement: Необязательное обогащение деталей компонента

Чтения свойств и зависимостей SHALL сохранять прежний глобальный контракт без `include`. Системное обогащение `include=platformParams` либо `include=reuseConfig` SHALL выполняться на системном пути. Чтение осей оформления SHALL сохранять существующие значения и значения по умолчанию.

#### Scenario: Детали запрошены
- **WHEN** клиент передал `include=platformParams` для системного `/components/{id}/properties` либо `include=reuseConfig` для системного `/components/{id}/deps`
- **THEN** сервер MUST собрать дополнительные данные только указанной системы и сохранить доступные метаданные родителей/детей

#### Scenario: Вариации уже доступны в первом Change
- **WHEN** клиент читает системный `GET /appearances/{id}/variations`
- **THEN** контракт MUST сохранить обязательный `appearanceId`, оси, значения и `defaultStyleId` без нового `include=values,defaults`

#### Scenario: Предметный контекст расширения
- **WHEN** системное расширение зависит от связи глобального ресурса с выбранной системой
- **THEN** сервер MUST проверить эту связь и принадлежность настроек системе пути
- **AND** старые глобальные ID-чтения без расширения MUST NOT получить обязательный `designSystemId`

#### Scenario: Платформы и формат сохранены
- **WHEN** клиент читает глобальные детали без `include`
- **THEN** сервер MUST вернуть прежние массивы/объекты без `context/data` и без преобразования платформ токенов, компонентов и документации

#### Scenario: Расширение на глобальном пути
- **WHEN** клиент передаёт системные параметры расширения на глобальный путь
- **THEN** сервер MUST вернуть `400`, не выбирая систему из query вместо пути

### Requirement: Согласованное постраничное чтение групп токенов

API SHALL выдавать группы и подгруппы в одинаковом порядке с `limit`/`cursor` и без них: корневая группа, её подгруппы, следующая корневая группа. Порядок соседей MUST определяться `position` и стабильным ID при равенстве позиций. Продолжение MUST сохранять выбранную версию и фильтры.

#### Scenario: Граница страницы внутри дерева
- **WHEN** клиент последовательно читает все страницы групп выбранной версии
- **THEN** объединённый список MUST совпасть по составу и порядку с чтением без пагинации
- **THEN** каждая группа и подгруппа MUST встретиться ровно один раз

#### Scenario: Фильтр непосредственного родителя
- **WHEN** клиент передаёт `parentId` и `limit`
- **THEN** API MUST вернуть только непосредственных детей указанной группы в порядке `position`, ID

#### Scenario: Неподдерживаемый поиск групп
- **WHEN** клиент передаёт `name` или `query` маршруту групп
- **THEN** API MUST вернуть `400 INVALID_QUERY`, а не неотфильтрованный список

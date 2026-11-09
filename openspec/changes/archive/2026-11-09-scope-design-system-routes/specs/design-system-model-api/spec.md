## MODIFIED Requirements

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

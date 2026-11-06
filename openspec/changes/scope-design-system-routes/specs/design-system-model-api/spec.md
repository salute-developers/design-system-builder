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

#### Scenario: MCP передаёт выбранную систему
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

#### Scenario: Список остаётся массивом
- **WHEN** клиент читает токены или компоненты без параметров страницы
- **THEN** API MUST сохранить массив и существующие правила полного чтения

#### Scenario: Поддерживаемая страница
- **WHEN** клиент передаёт поддерживаемые `limit` и `cursor`
- **THEN** сервер MUST сохранить действующие ограничения, порядок и метаданные страницы, привязав курсор к системе и версии

#### Scenario: Системные детали и глобальный каталог
- **WHEN** реализация переиспользует существующие сценарии компонентов, стилей, вариаций или экспорта
- **THEN** глобальные детали компонента MUST использовать адрес под `catalog` без ID системы, а системные детали и агрегаты MUST использовать системный корень без отдельного сетевого запроса на каждую вариацию

### Requirement: Gateway authorization for model read API

Публичный вход SHALL авторизовать проектные запросы по общему префиксу `/api/projects/{projectId}/design-systems/...`: с ID системы для системных ресурсов и без него для глобальных. `ds-service` SHALL независимо применять доверенный проектный контекст и ожидаемую систему.

#### Scenario: Разрешённое чтение
- **WHEN** аутентифицированный клиент читает системный ресурс
- **THEN** публичный вход MUST проверить доступ к проекту и сформировать доверенный контекст, а сервис MUST проверить разрешение, принадлежность ресурса проекту и системе пути

#### Scenario: Поддельные заголовки
- **WHEN** клиент передаёт собственные заголовки доверенного контекста или ожидаемой системы
- **THEN** публичный вход MUST NOT принимать их как источник разрешений или замены ID системы пути

#### Scenario: Неверный проект
- **WHEN** проектный ключ или участник не имеет доступа к проекту пути
- **THEN** запрос MUST быть отклонён до выполнения предметной операции

### Requirement: Web client compatibility

Веб-клиент SHALL использовать канонические системные URL и сохранить существующие пользовательские операции, формы DTO и предметную семантику. Старые системные адреса SHALL NOT использоваться как резервный путь.

#### Scenario: Редактор читает и сохраняет
- **WHEN** пользователь открывает систему, переключает тему, редактирует токены или конфигурацию
- **THEN** чтения, мутации, публикация и SSE MUST передавать выбранную систему в пути, сохраняя результаты пользовательских действий

#### Scenario: Объединённые списки
- **WHEN** веб-клиент читает токены, темы или конфигурации после объединения обработчиков
- **THEN** ответ MUST сохранить необходимые поля обычного и сводного представлений, включая группы/публикацию токенов и редакцию/preview тем

### Requirement: Вариации ограничены дизайн-системой

Чтение и изменение осей SHALL выполняться внутри обязательного системного пути; вариация SHALL сохранять `designSystemId` в DTO ответа; во входном DTO дублирующего поля SHALL NOT быть. Глобальное определение компонента SHALL NOT приобретать единственного владельца-дизайн-систему.

#### Scenario: Чтение осей компонента
- **WHEN** клиент читает системный `GET /components/{id}/variations`
- **THEN** API MUST вернуть массив осей только системы пути

#### Scenario: Чтение без системы
- **WHEN** клиент вызывает прежние `/ds/variations` или `/ds/components/{id}/variations`
- **THEN** API MUST вернуть `404`, не перечисляя оси всех доступных систем

#### Scenario: Создание оси без дублирования системы
- **WHEN** клиент создаёт ось по системному пути с допустимыми данными без `designSystemId` в теле
- **THEN** API MUST использовать систему пути и MUST NOT требовать её дублирования в теле

#### Scenario: Создание оси в чужой системе
- **WHEN** система пути недоступна вызывающему на запись
- **THEN** API MUST отклонить запрос прежней ошибкой авторизации/принадлежности и MUST NOT создать ось

### Requirement: Необязательное обогащение деталей компонента

Чтения свойств и зависимостей SHALL сохранять прежний глобальный контракт без `include`. Системное обогащение `include=platformParams` либо `include=reuseConfig` SHALL выполняться на системном пути. Чтение осей оформления SHALL сохранять существующие значения и значения по умолчанию.

#### Scenario: Детали запрошены
- **WHEN** клиент передал `include=platformParams` для системного `/components/{id}/properties` либо `include=reuseConfig` для системного `/components/{id}/deps`
- **THEN** сервер MUST собрать дополнительные данные только указанной системы и сохранить доступные метаданные родителей/детей

#### Scenario: Вариации уже доступны
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

#### Scenario: Проверка манифеста

- **WHEN** контрактный тест перечисляет предметные методы и пути
- **THEN** зарегистрированные маршруты MUST совпасть с каноническим набором, OpenAPI и манифестом; дубли MUST отсутствовать

#### Scenario: Публичный и внутренний входы

- **WHEN** системный метод вызывается публично через D либо через самостоятельный `/api/design-systems/{designSystemId}`
- **THEN** сервис MUST применить одинаковую границу системы и DTO; внутренние глобальные маршруты MUST использовать `/api/design-systems/catalog/{resource}`, административные — `/api/admin/...`, без регистрации или нормализации через `/api/ds`
- **AND** детали внутреннего пути MUST NOT попадать в публичный DTO

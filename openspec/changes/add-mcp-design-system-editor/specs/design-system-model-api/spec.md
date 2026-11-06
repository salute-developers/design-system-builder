## MODIFIED Requirements

### Requirement: Project-scoped token read API
API предметной модели DS Builder SHALL предоставлять через `ds-service` project-scoped endpoints чтения эталонных токенов и их значений.

#### Scenario: Список токенов дизайн-системы
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/tokens`
- **THEN** API MUST вернуть краткие данные токенов из системного источника истины
- **THEN** ответ MUST сохранить существующую форму массива
- **THEN** ответ MUST поддерживать необязательные фильтры типа токена и текстового запроса
- **THEN** `ds-service` MUST проверить, что запрошенная дизайн-система принадлежит trusted `X-Project-Id` или глобально доступна этому проекту
- **THEN** `ds-service` MUST потребовать `tokens:read`
- **THEN** ответ MUST NOT строиться из публикаций документации

#### Scenario: Чтение токена по стабильному идентификатору
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/tokens/{tokenId}`
- **THEN** API MUST вернуть эталонный DTO токена с идентификатором, типом, отображаемыми метаданными и метаданными ревизии при их наличии
- **THEN** `ds-service` MUST проверить, что токен принадлежит именно дизайн-системе URL, доступной trusted `X-Project-Id`
- **THEN** API MUST вернуть `404`, если токен не принадлежит trusted project

#### Scenario: Чтение значений токена с фильтрами
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/tokens/{tokenId}/values` с необязательными фильтрами темы, режима или платформы
- **THEN** API MUST вернуть эталонные DTO значений токена из системной модели
- **THEN** API MUST сохранить метаданные исходного, ссылочного и разрешённого значения, если эти понятия представлены в исходной модели

#### Scenario: Стабильность существующих маршрутов токенов
- **WHEN** MCP читает один токен или его значения по стабильному идентификатору
- **THEN** API MUST использовать `/api/projects/{projectId}/design-systems/{designSystemId}/tokens/{tokenId}` и его подресурс `/values`
- **THEN** эти маршруты MUST проверять project ownership и `tokens:read`, проверяя принадлежность токена DS URL без сохранения прежнего публичного пути

### Requirement: Project-scoped component read API
API предметной модели DS Builder SHALL предоставлять через `ds-service` project-scoped endpoints чтения эталонных данных компонентов, конфигураций, стилей и вариаций.

#### Scenario: Список компонентов дизайн-системы
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/components`
- **THEN** API MUST вернуть краткие данные компонентов из системного источника истины
- **THEN** ответ MUST включать стабильные идентификаторы компонентов и имена доступных стилей
- **THEN** ответ MUST сохранить существующую форму массива
- **THEN** ответ MUST поддерживать необязательный текстовый запрос
- **THEN** `ds-service` MUST проверить, что дизайн-система принадлежит trusted `X-Project-Id` или глобально доступна проекту
- **THEN** `ds-service` MUST потребовать `components:read`

#### Scenario: Чтение компонента
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/components/{componentId}`
- **THEN** API MUST вернуть эталонные метаданные компонента и доступные ссылки на конфигурацию
- **THEN** `ds-service` MUST проверить связь компонента с конкретной дизайн-системой URL, доступной trusted project
- **THEN** API MUST вернуть `404`, если компонент не подключён к DS URL или недоступен trusted project

#### Scenario: Чтение пакета конфигураций компонентов
- **WHEN** аутентифицированный клиент вызывает `POST /api/projects/{projectId}/design-systems/{designSystemId}/component-config/export` с `designSystemId` и необязательными фильтрами `components` или `styles`
- **THEN** API MUST вернуть эталонный пакет конфигураций с именами компонентов, стилей и канонической общей конфигурацией
- **THEN** API MUST ограничить пакет указанными фильтрами компонентов и стилей
- **THEN** API MUST потребовать `components:read`

#### Scenario: Чтение одной конфигурации из пакетного контракта
- **WHEN** MCP требуется `component_config_get` для одного компонента и необязательного стиля
- **THEN** frontend application layer MUST вызвать `POST /api/projects/{projectId}/design-systems/{designSystemId}/component-config/export` с фильтрами компонента и стиля, когда backend их поддерживает
- **THEN** API MUST вернуть каноническую общую конфигурацию

#### Scenario: Чтение стилей и вариаций компонента
- **WHEN** аутентифицированный клиент вызывает `GET /api/projects/{projectId}/design-systems/{designSystemId}/components/{componentId}/styles` или `GET /api/projects/{projectId}/design-systems/{designSystemId}/components/{componentId}/variations`
- **THEN** API MUST вернуть эталонные DTO стилей и вариаций из системной модели
- **THEN** ответ MUST включать стабильные идентификаторы для сопоставления модельных данных с code bindings
- **THEN** оба endpoint MUST быть ограничены DS URL; общий каталог меты компонента MUST оставаться отдельным API

### Requirement: Gateway authorization for model read API
Gateway SHALL публиковать API чтения токенов и компонентов через project-scoped authorization и trusted project context, а `ds-service` SHALL независимо проверять этот контекст.

#### Scenario: Существующий маршрут Gateway передаёт разрешённый запрос
- **WHEN** аутентифицированный клиент вызывает endpoint чтения токена или компонента через `/api/projects/{projectId}/design-systems/{designSystemId}/...`
- **THEN** Gateway MUST проверить project-scoped authentication по существующей семантике пользовательской сессии или project access key
- **THEN** Gateway MUST передать trusted project context в `ds-service`
- **THEN** изменение MUST использовать новый канонический публичный маршрут `/api/projects/{projectId}/design-systems/{designSystemId}/...`

#### Scenario: Неавторизованный запрос отклоняется
- **WHEN** клиент вызывает endpoint чтения токена или компонента без действительной project-scoped authentication
- **THEN** Gateway MUST отклонить запрос с `401` или `403`
- **THEN** `ds-service` MUST отклонить отсутствующий или противоречивый trusted context при прямом обращении
- **THEN** `ds-service` MUST NOT выводить trusted project identity только из управляемых клиентом path или query parameters

### Requirement: Web client compatibility
Изменения API чтения SHALL сохранять пользовательское поведение js/apps/client при согласованном переносе его URL в том же изменении.

#### Scenario: Existing web client endpoints remain compatible
- **WHEN** выполняется перенос URL данных DS и добавление MCP-мутаций
- **THEN** js/apps/client MUST перейти на новые URL данных DS в том же изменении, сохраняя DTO и поведение интерфейса
- **THEN** реализация MUST обновить построение URL, выбор DS, SSE, ключи кэша и повторы запросов

#### Scenario: Frontend Kotlin clients may migrate
- **WHEN** новые URL затрагивают frontend-kt/cli или общие прикладные сценарии
- **THEN** реализация MUST обновить frontend-kt/cli вместе с общими адаптерами
- **THEN** изменения CLI MUST сохранять пользовательские команды и обновлять их документацию в том же изменении

### Requirement: Полный разрешённый набор предметных маршрутов

`ds-service` SHALL сохранять следующий набор предметных операций. Суффиксы таблицы идентифицируют прежние операции до переноса: публичные адреса данных конкретной DS SHALL строиться относительно `/api/projects/{projectId}/design-systems/{designSystemId}`, а каталоговые — относительно прежнего `/api/projects/{projectId}/ds`. Коллекция систем SHALL находиться на `/api/projects/{projectId}/design-systems`. Канонические пути и области MUST быть явно опубликованы в OpenAPI и манифесте.

#### Scenario: Полный перечень маршрутов по ресурсам

- **WHEN** проверяется соответствие предметного API разрешённому набору маршрутов
- **THEN** набор MUST соответствовать следующей таблице

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
| Конфигурация компонента | `GET /component-config?ds={ds}&version={version}&appearance={appearance}&component={component}`, `POST /component-config/import`, `POST /component-config/export`, `POST /component-config/web-adapter` |

#### Scenario: Проверка route manifest

- **WHEN** контрактный тест перечисляет маршруты `ds-service`
- **THEN** каждая действующая операция таблицы MUST иметь явное отображение на канонический путь своей области с указанным HTTP-методом
- **AND** сервис MUST NOT добавлять предметный маршрут вне таблицы без нового OpenSpec-изменения

#### Scenario: Доступ через внешний и внутренний префиксы

- **WHEN** клиент вызывает канонический публичный путь операции таблицы
- **THEN** Gateway MUST использовать общую декларативную карту областей project/DS/catalog/admin, сохраняя projectId, designSystemId и query
- **AND** публичный DTO MUST NOT содержать детали внутреннего переписывания пути

### Requirement: Совместимость перенесённого API

Каждый перенесённый маршрут SHALL сохранять наблюдаемый контракт прежнего `db-service`, зафиксированный в OpenAPI `ds-service`: формы DTO и семантику полей; обязательная область designSystemId переносится в path и дублирующие прежние DS-поля допускаются только при совпадении с URL; форму JSON, семантику `null` и отсутствующих полей, коды успешных ответов, предметные ошибки, порядок элементов там, где он стабилен, и транзакционные границы.

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

## ADDED Requirements

### Requirement: Каноническая адресация данных дизайн-системы

Все публичные чтения и мутации данных конкретной DS в ds-service SHALL использовать `/api/projects/{projectId}/design-systems/{designSystemId}/…` без промежуточного ds. Коллекция и создание систем SHALL использовать `/api/projects/{projectId}/design-systems`. Прежние публичные DS-пути MUST NOT оставаться обходом новой области.

#### Scenario: Полный перенос предметных операций
- **WHEN** клиент читает или меняет токены/значения, темы/палитру, семейства/группы, подключения компонентов, вариации, стили, конфигурации, свойства, состояния значений, платформенные поправки или конфигурации повторного использования
- **THEN** действующий маршрут MUST содержать projectId и designSystemId в path
- **THEN** правило MUST применяться к спискам, чтению по ID, созданию, изменению, удалению, импорту и экспорту

#### Scenario: Версии, журнал и уведомления
- **WHEN** клиент читает версии, журнал/summary/token-ids, выполняет существующую публикацию/откат или открывает SSE конкретной DS
- **THEN** маршрут и курсоры MUST быть ограничены DS URL без изменения предметного поведения

#### Scenario: Коллекция систем
- **WHEN** клиент обнаруживает доступные DS проекта либо создаёт систему
- **THEN** маршрут MUST быть уровня проекта и MUST NOT требовать ID ещё не выбранной или не созданной DS

#### Scenario: Старый публичный адрес
- **WHEN** клиент вызывает прежний адрес данных DS без новой обязательной области
- **THEN** публичный вход MUST вернуть 404, а не выполнить запрос, перенаправить мутацию или угадать DS

### Requirement: Общий каталог отделён от области DS

Общие определения компонентов, свойств, платформенных параметров, состояний и наборов состояний, глобальная палитра, зависимости каталога и общие preview-плагины SHALL оставаться вне пути конкретной DS. Существующие права и административные ограничения MUST сохраняться.

#### Scenario: Каталоговая операция
- **WHEN** клиент запрашивает общую мету или административное изменение каталога
- **THEN** операция MUST использовать свой каталоговый или административный адрес без произвольной DS
- **THEN** DS URL MUST NOT давать право изменять общий каталог

#### Scenario: Вариации принадлежат DS
- **WHEN** читаются или меняются вариации и связи property_variations, принадлежащие DS после V14
- **THEN** они MUST использовать DS URL несмотря на прежнее каталоговое происхождение

### Requirement: Область чтения определяется DS маршрута

DS URL SHALL ограничивать все списки, чтения по ID, агрегаты и серверные проекции до формирования ответа и пагинации. Ресурс другой DS MUST NOT возвращаться даже пользователю с доступом к обеим. Общие данные допускаются только как явно разрешённая мета или зависимость запрошенного DS-ресурса.

#### Scenario: Чужой ID того же проекта
- **WHEN** URL указывает A, а tokenId, tenantId, appearanceId, axisId, valueId, groupId, versionId или changeId относится к B
- **THEN** чтение MUST вернуть 404 без данных B

#### Scenario: Список и страница
- **WHEN** запрос списка ограничен DS A
- **THEN** items, counts и cursor MUST вычисляться для A, а не фильтроваться клиентом после чтения данных проекта

#### Scenario: Дублирующий ID системы
- **WHEN** прежнее поле designSystemId в теле или query не совпадает с path
- **THEN** запрос MUST быть отклонён до предметной операции

### Requirement: Перенос не смешивает разные формы ответа

При переносе API SHALL сохранять DTO, null-семантику, порядок, фильтры, пагинацию и метаданные существующих операций. Прежние операции с разными DTO и одинаковым новым адресом MUST получить разные канонические суффиксы; эквивалентные операции допускается объединить.

#### Scenario: Два списка токенов
- **WHEN** переносятся DS-проекция списка токенов и общий список TokenResponse
- **THEN** проекция MUST находиться на DS-пути /tokens, а список TokenResponse[] — на /token-records
- **THEN** их формы и семантика MUST NOT переключаться неявно по случайным query-полям

#### Scenario: Разные списки тем
- **WHEN** переносятся прежняя сводка тем DS и общий список TenantResponse[] с preview/editRevision
- **THEN** сводка MUST использовать /tenants, а TenantResponse[] — /tenant-records без потери полей

#### Scenario: Сводки оформлений
- **WHEN** переносится прежний список DesignSystemAppearanceSummaryResponse[]
- **THEN** он MUST использовать /appearance-summaries без коллизии с существующим /appearances

### Requirement: Потребители переносятся вместе с серверным API

Все потребители изменённых DS-маршрутов в репозитории SHALL перейти на новые URL в том же Change: веб-клиент, Kotlin CLI/MCP, IDE-плагины, серверные адаптеры и скрипты. Пользовательские команды и URI контекста SHALL сохраняться; выбор DS MUST NOT угадываться.

#### Scenario: Обновлённый клиент
- **WHEN** клиент выбирает DS и выполняет прежний пользовательский сценарий
- **THEN** чтения, записи, повторы, SSE и кэши MUST использовать эту DS и новый URL

#### Scenario: Серверный потребитель
- **WHEN** другая подсистема проверяет владельца DS или обращается к её данным
- **THEN** её HTTP-адаптер MUST использовать согласованный новый контракт, сохраняя права и внутрипроцессные границы

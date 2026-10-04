## ADDED Requirements

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

## MODIFIED Requirements

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

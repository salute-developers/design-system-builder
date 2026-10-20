## MODIFIED Requirements

### Requirement: Исключённые маршруты не входят в Kotlin-сервис

`ds-service` MUST NOT реализовывать маршруты `documentation-pages`, `saved-queries`, `/legacy/**`, а также операции генерации артефактов. Единственный административный маршрут продукта — импорт API-меты в глобальный слой компонентов, он выполняется в `ds-service` под внутренним путём `/api/ds/admin/component-config/import-api-meta`; других маршрутов `/api/admin/**` в продукте нет.

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

Каждый перенесённый маршрут SHALL сохранять наблюдаемый контракт прежнего `db-service`, зафиксированный в OpenAPI `ds-service`: имена и обязательность path/query/body полей, форму JSON, семантику `null` и отсутствующих полей, коды успешных ответов, предметные ошибки, порядок элементов там, где он стабилен, и транзакционные границы.

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

### Requirement: ds-service обслуживает web-адаптер

`ds-service` SHALL обслуживать `POST /api/ds/component-config/web-adapter` с телом `{ "designSystemId": "<uuid>" }`
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

## REMOVED Requirements

### Requirement: Gateway compatibility routing для legacy API

**Reason**: Маршруты `/ds/legacy/**` обслуживал только db-service; он удалён.

**Migration**: Клиент и CLI используют `component-config/export`, `web-adapter` и ручки тем ds-service.

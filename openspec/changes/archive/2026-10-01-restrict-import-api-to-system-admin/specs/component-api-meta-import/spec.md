## MODIFIED Requirements

### Requirement: API meta import endpoint

`db-service` SHALL предоставлять endpoint `POST /api/admin/component-config/import-api-meta`, принимающий манифест API-меты компонентов целиком одним запросом и записывающий его в глобальный слой компонентной модели в одной транзакции. Проектный маршрут `POST /api/projects/{projectId}/ds/component-config/import-api-meta` MUST NOT существовать.

#### Scenario: Манифест принимается одним запросом

- **WHEN** клиент отправляет манифест с несколькими компонентами
- **THEN** backend MUST обработать все компоненты в одном запросе и одной транзакции
- **THEN** путь запроса MUST NOT содержать идентификаторов проекта или дизайн-системы и custom method через двоеточие

#### Scenario: Запрос не адресуется дизайн-системе

- **WHEN** клиент отправляет манифест
- **THEN** backend MUST NOT требовать в теле `designSystemId`
- **THEN** backend MUST NOT искать дизайн-систему и MUST NOT отвечать `404` из-за неё

#### Scenario: Проектный маршрут удалён

- **WHEN** клиент обращается к `POST /api/projects/{projectId}/ds/component-config/import-api-meta`
- **THEN** backend MUST ответить `404`

#### Scenario: Невалидное тело

- **WHEN** тело не проходит валидацию схемы запроса
- **THEN** backend MUST ответить статусом валидации и MUST NOT изменить данные

### Requirement: API meta manifest contract

Тело запроса SHALL содержать `platform`, `meta`, `dryRun` и список `components`; каждый компонент SHALL содержать `name`, список `properties` и список `states`, а каждое свойство — `name`, `type`, непустой список платформенных имён `platformNames` и необязательное `description`. Backend MUST также принимать прежнее поле `platformName` (одно имя) вместо `platformNames`.

#### Scenario: Платформа из словаря БД

- **WHEN** запрос содержит `platform`
- **THEN** backend MUST принимать только значения `xml`, `compose`, `ios`, `web`
- **THEN** backend MUST NOT ограничивать платформы теми, что CLI уже умеет читать

#### Scenario: Формат меты платформы не передаётся

- **WHEN** backend разбирает манифест
- **THEN** он MUST NOT требовать и MUST NOT интерпретировать поля исходного формата меты (`group`, `paramSimpleType`, `stateEnum`, `attrName`, `stateSets`)

#### Scenario: Источник меты — имя файла

- **WHEN** запрос содержит `meta.source`
- **THEN** backend MUST трактовать его как справочное имя файла и MUST NOT требовать, чтобы это был путь

#### Scenario: Список платформенных имён

- **WHEN** свойство содержит `platformNames` из нескольких имён
- **THEN** backend MUST принять запрос и MUST учесть каждое имя

#### Scenario: Прежнее поле одного имени

- **WHEN** свойство содержит `platformName` и не содержит `platformNames`
- **THEN** backend MUST обработать его как список из одного имени

#### Scenario: Оба поля

- **WHEN** свойство содержит и `platformNames`, и `platformName`
- **THEN** backend MUST использовать `platformNames`

#### Scenario: Имён нет

- **WHEN** свойство не содержит ни `platformNames`, ни `platformName`, либо `platformNames` пуст
- **THEN** backend MUST ответить ошибкой валидации и MUST NOT изменить данные

### Requirement: API meta import is additive

Импорт SHALL создавать компоненты, состояния компонентов, свойства и алиасы платформенных имён, которых ещё нет, и MUST NOT изменять или удалять существующие строки. Импорт MUST NOT создавать привязки компонентов к дизайн-системам.

#### Scenario: Новый компонент создаётся вместе со свойствами и состояниями

- **WHEN** компонента с таким `name` нет
- **THEN** backend MUST создать компонент, его свойства, его состояния и алиасы `(property, platform, name)` для каждого платформенного имени

#### Scenario: Привязка к дизайн-системе не создаётся

- **WHEN** компонент импортируется
- **THEN** backend MUST NOT создавать и MUST NOT изменять строки привязок компонентов к дизайн-системам

#### Scenario: Несколько платформенных имён одного свойства

- **WHEN** свойство содержит несколько платформенных имён
- **THEN** backend MUST создать по одному алиасу на каждое имя, которого у свойства на этой платформе ещё нет
- **THEN** существующие алиасы MUST NOT изменяться и MUST NOT удаляться

#### Scenario: Существующие строки не меняются

- **WHEN** компонент, свойство, состояние или алиас уже существует
- **THEN** backend MUST NOT изменять его поля, включая `description`
- **THEN** backend MUST NOT создавать дубликат

#### Scenario: Расхождение типа существующего свойства

- **WHEN** свойство с таким `(component, name)` существует с другим `type`
- **THEN** backend MUST NOT менять тип
- **THEN** backend MUST вернуть запись в `typeMismatches`
- **THEN** алиасы платформы MUST быть созданы, если их ещё нет

#### Scenario: Повторный импорт не создаёт данных

- **WHEN** тот же манифест применён повторно
- **THEN** все счётчики `created*` MUST быть равны нулю

#### Scenario: Порядок импорта платформ не влияет на состав данных

- **WHEN** манифесты двух платформ с совпадающими типами общих свойств импортируются в любом порядке
- **THEN** набор компонентов, свойств, их типов и состояний MUST быть одинаковым при обоих порядках

### Requirement: API meta import report

Ответ SHALL содержать счётчики `createdComponents`, `createdProperties`, `createdStates`, `createdAliases`, `unchangedProperties` и списки `rejected` и `typeMismatches`. Счётчика привязок к дизайн-системам MUST NOT быть.

#### Scenario: Успешный ответ

- **WHEN** импорт завершён
- **THEN** ответ MUST иметь статус `200` и содержать все перечисленные поля
- **THEN** ответ MUST NOT содержать `createdLinks`

#### Scenario: Ошибка транзакции

- **WHEN** запись в БД завершается ошибкой
- **THEN** backend MUST откатить транзакцию и ответить `422` с кратким сообщением
- **THEN** причина MUST быть записана в лог сервера

## ADDED Requirements

### Requirement: API meta import is restricted to system administrators

Импорт API-меты SHALL быть доступен только системному администратору. Backend MUST проверять доверенный заголовок `X-System-Admin` и MUST отказывать во всех остальных случаях, включая отсутствие заголовка.

#### Scenario: Системный администратор

- **WHEN** запрос приходит с `X-System-Admin: true`
- **THEN** backend MUST выполнить импорт

#### Scenario: Не системный администратор

- **WHEN** запрос приходит с `X-System-Admin`, отличным от `true`, например с `false` (пользователь без роли или ключ проекта)
- **THEN** backend MUST ответить `403` и MUST NOT изменить данные

#### Scenario: Заголовка нет

- **WHEN** запрос приходит без заголовка `X-System-Admin` (прямой вызов в обход gateway)
- **THEN** backend MUST ответить `403` и MUST NOT изменить данные

#### Scenario: Проверка до разбора тела

- **WHEN** запрос отклоняется как не административный
- **THEN** backend MUST ответить `403` до разбора тела, даже если тело невалидно

#### Scenario: Ключ проекта не принимается gateway

- **WHEN** запрос на административный маршрут приходит с `Authorization: ProjectKey <token>`
- **THEN** gateway MUST ответить `401` и MUST NOT передавать запрос в backend

### Requirement: API meta import is recorded in the changes journal

Применённый импорт SHALL записываться в `design_system_changes` в той же транзакции, что и сам импорт, без привязки к дизайн-системе. Колонка `design_system_id` MUST допускать отсутствие значения.

#### Scenario: Запись без дизайн-системы

- **WHEN** импорт применён без `dryRun`
- **THEN** backend MUST записать строку с `entity_type` `components:import-api-meta` и пустым `design_system_id`
- **THEN** `entity_id` MUST быть идентификатором запуска, созданным backend'ом

#### Scenario: Содержимое записи

- **WHEN** строка журнала записана
- **THEN** `data` MUST содержать идентификатор пользователя из `X-User-Id`, платформу, имя файла меты, признак `dryRun` и счётчики отчёта
- **THEN** `operation` MUST быть `created`, если созданы компоненты или свойства, и `updated` в остальных случаях

#### Scenario: Dry run не оставляет записи

- **WHEN** `dryRun` равен `true`
- **THEN** backend MUST NOT сохранить строку журнала

#### Scenario: Записи нет в лентах дизайн-систем

- **WHEN** запрашивается лента изменений конкретной дизайн-системы
- **THEN** она MUST NOT содержать записей об импорте API-меты

## ADDED Requirements

### Requirement: API meta import endpoint

`db-service` SHALL предоставлять endpoint `POST /api/projects/{projectId}/ds/component-config/import-api-meta`, принимающий манифест API-меты компонентов целиком одним запросом и записывающий его в глобальный слой компонентной модели в одной транзакции.

#### Scenario: Манифест принимается одним запросом

- **WHEN** клиент отправляет манифест с несколькими компонентами
- **THEN** backend MUST обработать все компоненты в одном запросе и одной транзакции
- **THEN** путь запроса MUST NOT содержать `designSystemId` и custom method через двоеточие

#### Scenario: Дизайн-система адресуется телом запроса

- **WHEN** тело запроса содержит `designSystemId`
- **THEN** backend MUST проверить, что он является uuid
- **THEN** backend MUST ответить `404`, если дизайн-система не найдена или не принадлежит проекту запроса

#### Scenario: Запрос без права записи отклоняется до разбора тела

- **WHEN** ключ проекта не содержит scope `components:write`
- **THEN** backend MUST ответить `403`
- **THEN** backend MUST NOT разбирать тело запроса

#### Scenario: Невалидное тело

- **WHEN** тело не проходит валидацию схемы запроса
- **THEN** backend MUST ответить статусом валидации и MUST NOT изменить данные

### Requirement: API meta manifest contract

Тело запроса SHALL содержать `designSystemId`, `platform`, `meta`, `dryRun` и список `components`; каждый компонент SHALL содержать `name`, список `properties` и список `states`, а каждое свойство — `name`, `type`, `platformName` и необязательное `description`.

#### Scenario: Платформа из словаря БД

- **WHEN** запрос содержит `platform`
- **THEN** backend MUST принимать только значения `xml`, `compose`, `ios`, `web`
- **THEN** backend MUST NOT ограничивать платформы теми, что CLI уже умеет читать

#### Scenario: Формат меты платформы не передаётся

- **WHEN** backend разбирает манифест
- **THEN** он MUST NOT требовать и MUST NOT интерпретировать поля исходного формата меты (`group`, `paramSimpleType`, `stateEnum`)

### Requirement: API meta import is additive

Импорт SHALL создавать компоненты, состояния компонентов, свойства, алиасы платформенных имён и привязки к дизайн-системе, которых ещё нет, и MUST NOT изменять или удалять существующие строки.

#### Scenario: Новый компонент создаётся вместе со свойствами и состояниями

- **WHEN** компонента с таким `name` нет
- **THEN** backend MUST создать компонент, его свойства, его состояния и алиасы `(property, platform, platformName)`
- **THEN** backend MUST привязать компонент к дизайн-системе из запроса

#### Scenario: Существующие строки не меняются

- **WHEN** компонент, свойство, состояние или алиас уже существует
- **THEN** backend MUST NOT изменять его поля, включая `description`
- **THEN** backend MUST NOT создавать дубликат

#### Scenario: Привязка только к указанной дизайн-системе

- **WHEN** компонент импортируется
- **THEN** backend MUST NOT привязывать его к другим дизайн-системам

#### Scenario: Расхождение типа существующего свойства

- **WHEN** свойство с таким `(component, name)` существует с другим `type`
- **THEN** backend MUST NOT менять тип
- **THEN** backend MUST вернуть запись в `typeMismatches`
- **THEN** алиас платформы MUST быть создан, если его ещё нет

#### Scenario: Повторный импорт не создаёт данных

- **WHEN** тот же манифест применён повторно
- **THEN** все счётчики `created*` MUST быть равны нулю

### Requirement: Property type validation belongs to backend

Backend SHALL проверять `type` свойства по значениям `property_type` и MUST NOT принимать типы вне этого списка.

#### Scenario: Неизвестный тип отклоняет свойство, а не импорт

- **WHEN** свойство содержит тип вне `property_type`
- **THEN** backend MUST вернуть свойство в `rejected` с причиной, содержащей тип
- **THEN** backend MUST импортировать остальные свойства и компоненты

#### Scenario: Схема БД не меняется

- **WHEN** тип неизвестен
- **THEN** backend MUST NOT выполнять DDL и MUST NOT расширять enum

### Requirement: API meta import dry run

Импорт SHALL поддерживать `dryRun`, выполняющий всю работу и откатывающий транзакцию.

#### Scenario: Отчёт dry run совпадает с отчётом применения

- **WHEN** запрос с `dryRun: true` и запрос с `dryRun: false` выполняются на одном состоянии БД с одним манифестом
- **THEN** их отчёты MUST совпадать

#### Scenario: Dry run не сохраняет данные

- **WHEN** `dryRun` равен `true`
- **THEN** backend MUST NOT сохранить ни одной строки, включая запись в `design_system_changes`

### Requirement: API meta import report

Ответ SHALL содержать счётчики `createdComponents`, `createdProperties`, `createdStates`, `createdAliases`, `createdLinks`, `unchangedProperties` и списки `rejected` и `typeMismatches`.

#### Scenario: Успешный ответ

- **WHEN** импорт завершён
- **THEN** ответ MUST иметь статус `200` и содержать все перечисленные поля

#### Scenario: Ошибка транзакции

- **WHEN** запись в БД завершается ошибкой
- **THEN** backend MUST откатить транзакцию и ответить `422` с кратким сообщением
- **THEN** причина MUST быть записана в лог сервера

#### Scenario: Изменение фиксируется в журнале

- **WHEN** импорт применён без `dryRun`
- **THEN** backend MUST записать в `design_system_changes` событие импорта с метаданными запроса и счётчиками отчёта

## MODIFIED Requirements

### Requirement: API meta manifest contract

Тело запроса SHALL содержать `designSystemId`, `platform`, `meta`, `dryRun` и список `components`; каждый компонент SHALL содержать `name`, список `properties` и список `states`, а каждое свойство — `name`, `type`, непустой список платформенных имён `platformNames` и необязательное `description`. Backend MUST также принимать прежнее поле `platformName` (одно имя) вместо `platformNames`.

#### Scenario: Платформа из словаря БД

- **WHEN** запрос содержит `platform`
- **THEN** backend MUST принимать только значения `xml`, `compose`, `ios`, `web`
- **THEN** backend MUST NOT ограничивать платформы теми, что CLI уже умеет читать

#### Scenario: Формат меты платформы не передаётся

- **WHEN** backend разбирает манифест
- **THEN** он MUST NOT требовать и MUST NOT интерпретировать поля исходного формата меты (`group`, `paramSimpleType`, `stateEnum`, `attrName`, `stateSets`)

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

Импорт SHALL создавать компоненты, состояния компонентов, свойства, алиасы платформенных имён и привязки к дизайн-системе, которых ещё нет, и MUST NOT изменять или удалять существующие строки.

#### Scenario: Новый компонент создаётся вместе со свойствами и состояниями

- **WHEN** компонента с таким `name` нет
- **THEN** backend MUST создать компонент, его свойства, его состояния и алиасы `(property, platform, name)` для каждого платформенного имени
- **THEN** backend MUST привязать компонент к дизайн-системе из запроса

#### Scenario: Несколько платформенных имён одного свойства

- **WHEN** свойство содержит несколько платформенных имён
- **THEN** backend MUST создать по одному алиасу на каждое имя, которого у свойства на этой платформе ещё нет
- **THEN** существующие алиасы MUST NOT изменяться и MUST NOT удаляться

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
- **THEN** алиасы платформы MUST быть созданы, если их ещё нет

#### Scenario: Повторный импорт не создаёт данных

- **WHEN** тот же манифест применён повторно
- **THEN** все счётчики `created*` MUST быть равны нулю

#### Scenario: Порядок импорта платформ не влияет на состав данных

- **WHEN** манифесты двух платформ с совпадающими типами общих свойств импортируются в любом порядке
- **THEN** набор компонентов, свойств, их типов и состояний MUST быть одинаковым при обоих порядках

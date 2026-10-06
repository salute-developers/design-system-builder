## ADDED Requirements

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

# component-api-meta-import Specification

## Purpose
Определяет ручку `import-api-meta` (обслуживается `ds-service`, публикуется Gateway как `/api/admin/component-config/import-api-meta`), которой CLI `dsbuilder components import-api` заводит глобальный слой компонентной модели (компоненты, свойства, состояния, платформенные имена и привязку к дизайн-системе) по манифесту API-меты платформы: контракт манифеста, аддитивную запись, проверку типов свойств по схеме БД, dry run и отчёт.
## Requirements
### Requirement: API meta import endpoint

`ds-service` SHALL выполнять импорт API-меты, а Gateway SHALL предоставлять его клиентам как `POST /api/admin/component-config/import-api-meta`, принимающий манифест API-меты компонентов целиком одним запросом и записывающий его в глобальный слой компонентной модели в одной транзакции. Gateway MUST переписывать этот путь в `ds-service` как `POST /api/ds/admin/component-config/import-api-meta`; `db-service` MUST NOT обслуживать этот маршрут. Проектный маршрут `POST /api/projects/{projectId}/ds/component-config/import-api-meta` MUST NOT существовать.

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

Тело запроса SHALL содержать `platform`, `meta`, `dryRun` и список `components`; каждый компонент SHALL содержать `name`, список `properties` и список `states`, а каждое свойство — `name`, `type`, непустой список платформенных имён `platformNames` и необязательное `description`. Элемент `platformNames` SHALL быть либо строкой (имя без сведений об устаревании), либо объектом `{ name, deprecated? }`, где `deprecated` — объект `{ message }` с текстовым `message` (пустая строка допустима). Backend MUST также принимать прежнее поле `platformName` (одно имя) вместо `platformNames`.

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

#### Scenario: Имя объектом с deprecated

- **WHEN** элемент `platformNames` — объект `{ name, deprecated: { message } }`
- **THEN** backend MUST принять запрос и MUST учесть `deprecated` для алиаса `name`

#### Scenario: Имя объектом без deprecated

- **WHEN** элемент `platformNames` — объект `{ name }` без `deprecated`
- **THEN** backend MUST трактовать алиас как неустаревший

#### Scenario: Имя строкой

- **WHEN** элемент `platformNames` — строка
- **THEN** backend MUST NOT менять статус устаревания существующего алиаса

#### Scenario: Прежнее поле одного имени

- **WHEN** свойство содержит `platformName` и не содержит `platformNames`
- **THEN** backend MUST обработать его как список из одного имени без сведений об устаревании

#### Scenario: Оба поля

- **WHEN** свойство содержит и `platformNames`, и `platformName`
- **THEN** backend MUST использовать `platformNames`

#### Scenario: Имён нет

- **WHEN** свойство не содержит ни `platformNames`, ни `platformName`, либо `platformNames` пуст
- **THEN** backend MUST ответить ошибкой валидации и MUST NOT изменить данные

#### Scenario: Сообщение не строка

- **WHEN** `deprecated.message` не является строкой
- **THEN** backend MUST ответить ошибкой валидации и MUST NOT изменить данные

### Requirement: API meta import is additive

Импорт SHALL идентифицировать компонент по паре `(name, platform запроса)`; он SHALL создавать компоненты этой платформы, состояния компонентов, свойства и алиасы платформенных имён, которых ещё нет, и MUST NOT изменять или удалять существующие строки. Единственное исключение — статус устаревания алиаса (`deprecated`, `deprecated_message`), который импорт обновляет по правилам требования об устаревании. Импорт MUST NOT создавать привязки компонентов к дизайн-системам и MUST NOT создавать и изменять компоненты других платформ.

#### Scenario: Новый компонент создаётся вместе со свойствами и состояниями

- **WHEN** компонента с таким `(name, platform)` нет
- **THEN** backend MUST создать компонент этой платформы, его свойства, его состояния и алиасы `(property, platform, name)` для каждого платформенного имени

#### Scenario: Компонент другой платформы не используется

- **WHEN** существует компонент с таким `name` только на другой платформе
- **THEN** backend MUST создать новый компонент платформы запроса и MUST NOT изменять компонент другой платформы

#### Scenario: Привязка к дизайн-системе не создаётся

- **WHEN** компонент импортируется
- **THEN** backend MUST NOT создавать и MUST NOT изменять строки привязок компонентов к дизайн-системам

#### Scenario: Несколько платформенных имён одного свойства

- **WHEN** свойство содержит несколько платформенных имён
- **THEN** backend MUST создать по одному алиасу на каждое имя, которого у свойства на этой платформе ещё нет
- **THEN** существующие алиасы MUST NOT удаляться, и их поля, кроме статуса устаревания, MUST NOT изменяться

#### Scenario: Существующие строки не меняются

- **WHEN** компонент, свойство, состояние или алиас уже существует
- **THEN** backend MUST NOT изменять его поля, включая `description`, кроме статуса устаревания алиаса
- **THEN** backend MUST NOT создавать дубликат

#### Scenario: Расхождение типа существующего свойства

- **WHEN** свойство с таким `(component, name)` на платформе запроса существует с другим `type`
- **THEN** backend MUST NOT менять тип
- **THEN** backend MUST вернуть запись в `typeMismatches`
- **THEN** алиасы платформы MUST быть созданы, если их ещё нет

#### Scenario: Тип свойства другой платформы не конфликтует

- **WHEN** свойство с тем же именем на другой платформе имеет другой тип
- **THEN** backend MUST NOT считать это расхождением и MUST NOT вернуть запись в `typeMismatches`

#### Scenario: Повторный импорт не создаёт данных

- **WHEN** тот же манифест применён повторно
- **THEN** все счётчики `created*` MUST быть равны нулю

#### Scenario: Порядок импорта платформ не влияет на состав данных

- **WHEN** манифесты двух платформ импортируются в любом порядке
- **THEN** набор компонентов, свойств, их типов и состояний каждой платформы MUST быть одинаковым при обоих порядках

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

Ответ SHALL содержать счётчики `createdComponents`, `createdProperties`, `createdStates`, `createdAliases`, `unchangedProperties`, `deprecatedMarked`, `deprecatedMessageChanged`, `deprecatedCleared` и списки `rejected`, `typeMismatches` и `absent`. Счётчика привязок к дизайн-системам MUST NOT быть.

#### Scenario: Успешный ответ

- **WHEN** импорт завершён
- **THEN** ответ MUST иметь статус `200` и содержать все перечисленные поля
- **THEN** ответ MUST NOT содержать `createdLinks`

#### Scenario: Ошибка транзакции

- **WHEN** запись в БД завершается ошибкой
- **THEN** backend MUST откатить транзакцию и ответить `422` с кратким сообщением
- **THEN** причина MUST быть записана в лог сервера

### Requirement: API meta import is restricted to system administrators

Импорт API-меты SHALL быть доступен только системному администратору. `ds-service` MUST проверять доверенный контекст (`X-System-Admin: true`) и MUST отказывать во всех остальных случаях, включая отсутствие заголовка. У глобальной операции проекта нет, поэтому Gateway MUST передавать служебный `X-Project-Id: global` только на этом маршруте и только после проверки токена пользователя.

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

### Requirement: API meta import maintains deprecation status

Импорт SHALL обновлять статус устаревания алиаса по манифесту. Для алиаса, пришедшего объектом: если задан `deprecated`, а алиас не помечен, backend MUST пометить его и записать сообщение; если задан `deprecated` с другим сообщением, backend MUST заменить сообщение; если `deprecated` не задан, а алиас помечен, backend MUST снять пометку и очистить сообщение. Для алиаса, пришедшего строкой, и для алиасов, которых нет в манифесте, backend MUST NOT менять статус. Статус каждого алиаса MUST обновляться независимо от статусов других алиасов того же свойства.

#### Scenario: Свойство стало устаревшим

- **WHEN** алиас не был помечен, а в манифесте пришёл с `deprecated: { message: "Use X" }`
- **THEN** алиас MUST стать устаревшим с сообщением `Use X`
- **THEN** `deprecatedMarked` MUST увеличиться на единицу

#### Scenario: Изменилось сообщение

- **WHEN** алиас помечен сообщением `A`, а в манифесте пришёл с сообщением `B`
- **THEN** сообщение MUST стать `B`
- **THEN** `deprecatedMessageChanged` MUST увеличиться на единицу

#### Scenario: Пометка исчезла из меты

- **WHEN** алиас помечен, а в манифесте пришёл объектом без `deprecated`
- **THEN** пометка MUST быть снята, а сообщение очищено
- **THEN** `deprecatedCleared` MUST увеличиться на единицу

#### Scenario: Пустое сообщение

- **WHEN** алиас приходит с `deprecated: { message: "" }`
- **THEN** алиас MUST стать устаревшим с пустым сообщением

#### Scenario: Алиас строкой

- **WHEN** алиас помечен, а в манифесте пришёл строкой
- **THEN** статус MUST остаться прежним и счётчики `deprecated*` MUST NOT измениться

#### Scenario: Алиаса нет в мете

- **WHEN** алиас помечен, а в манифесте его нет
- **THEN** алиас и его статус MUST остаться прежними

#### Scenario: Алиасы одного свойства независимы

- **WHEN** у свойства View два алиаса и в манифесте устарел только один
- **THEN** второй алиас MUST остаться неустаревшим

#### Scenario: Повторный импорт

- **WHEN** тот же манифест применён повторно
- **THEN** счётчики `deprecatedMarked`, `deprecatedMessageChanged` и `deprecatedCleared` MUST быть равны нулю

#### Scenario: Dry run

- **WHEN** `dryRun` равен `true`
- **THEN** счётчики `deprecated*` MUST совпадать с применением, а статусы MUST NOT измениться

### Requirement: API meta import reports what is absent from the meta

Ответ SHALL содержать список `absent`: компоненты платформы запроса, существующие в базе и отсутствующие в манифесте (запись `Component`), и свойства импортируемых компонентов, существующие в базе и отсутствующие в манифесте (запись `Component.property`). Список MUST быть справочным: он MUST NOT менять данные, MUST NOT влиять на код ответа и MUST NOT учитывать компоненты других платформ.

#### Scenario: Свойство исчезло из меты

- **WHEN** в базе у компонента платформы есть свойство, которого нет в манифесте
- **THEN** `absent` MUST содержать запись `Component.property`
- **THEN** свойство MUST остаться в базе без изменений

#### Scenario: Компонент исчез из меты

- **WHEN** в базе есть компонент платформы запроса, которого нет в манифесте
- **THEN** `absent` MUST содержать имя компонента
- **THEN** компонент MUST остаться в базе без изменений

#### Scenario: Другие платформы не учитываются

- **WHEN** в базе есть компонент другой платформы, которого нет в манифесте
- **THEN** `absent` MUST NOT содержать его

#### Scenario: Совпадение с мета

- **WHEN** манифест содержит всё, что есть в базе для платформы
- **THEN** `absent` MUST быть пустым


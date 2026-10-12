## MODIFIED Requirements

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

## ADDED Requirements

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

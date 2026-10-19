## ADDED Requirements

### Requirement: Тип семейства следует из вида значений

`ds-service` SHALL хранить у всех определений цветового токена тип `gradient`, если хотя бы одно значение
хотя бы одного члена семейства в какой-либо теме дизайн-системы, режиме или на платформе — градиент, и тип
`color` в остальных случаях. Тип SHALL вычисляться операциями создания и изменения значений цветового токена
в той же транзакции. Сплошные значения `ios` и `android` SHALL храниться строкой цвета у семейства типа `color`
и слоем `[{ "kind": "color", "background": <цвет> }]` у семейства типа `gradient` во всех темах. Web-значение
цвета SHALL храниться массивом из одной строки при любом типе.

#### Scenario: Градиент в одном режиме одной темы

- **WHEN** в дизайн-системе с темами A и B токен `surface` / `accent` типа `color` получает в теме B градиент
  в режиме `dark` на web, iOS и Android
- **THEN** все определения семейства MUST получить тип `gradient`
- **THEN** значения `ios` и `android` со сплошным цветом во всех темах MUST стать слоем
  `[{ "kind": "color", "background": <прежний цвет> }]`, а ссылки на палитру в них MUST сохраниться
- **THEN** web-значения со сплошным цветом MUST NOT измениться
- **THEN** `editRevision` тем A и B MUST увеличиться

#### Scenario: Убран последний градиент

- **WHEN** у семейства типа `gradient` единственное градиентное значение заменено цветом
- **THEN** все определения семейства MUST получить тип `color`
- **THEN** значения `ios` и `android` вида `[{ "kind": "color", "background": X }]` во всех темах MUST стать `[X]`
- **THEN** `editRevision` всех тем дизайн-системы MUST увеличиться

#### Scenario: Тип не меняется

- **WHEN** изменение значений не меняет вычисленный тип семейства
- **THEN** API MUST менять значения только текущей темы, и `editRevision` других тем MUST NOT измениться

#### Scenario: Создание с градиентом

- **WHEN** запрос создания содержит `type: "color"`, а значение какого-либо члена — градиент
- **THEN** API MUST создать определения с типом `gradient` и нормализовать сплошные значения `ios` и `android`
  в слой `color`
- **THEN** ответ MUST содержать `type: "gradient"`

#### Scenario: Пакетная запись не меняет тип

- **WHEN** значения пишутся через `PUT /tenants/{id}/token-values`
- **THEN** API MUST NOT менять тип определений

### Requirement: Градиентные семейства приводятся к виду значений миграцией

Миграция `ds-service` SHALL привести существующие семейства типа `gradient` к правилу вида значений во всех
дизайн-системах и темах. Семейство без градиента хотя бы в одном web-значении SHALL считаться цветовым: его
нативные градиенты — заглушки сида, которые на web не видны.

#### Scenario: Семейство-заглушка

- **WHEN** у всех членов семейства `text` / `accent-minor-gradient` во всех темах web-значение — HEX, а
  `ios` и `android` — слой `linear` «белый → чёрный»
- **THEN** после миграции все определения семейства MUST иметь тип `color`
- **THEN** web-значения MUST стать массивом из одной строки — первого HEX, а значения `ios` и `android` MUST
  стать тем же значением

#### Scenario: Семейство с градиентом

- **WHEN** хотя бы одно web-значение семейства `surface` / `accent-gradient` — градиентная функция
- **THEN** определения MUST сохранить тип `gradient`
- **THEN** у членов, чьё web-значение в той же теме и режиме — HEX, значения `ios` и `android` MUST стать
  `[{ "kind": "color", "background": <тот же HEX> }]`
- **THEN** градиентные значения `ios` и `android` MUST NOT измениться

#### Scenario: Сид после миграции

- **WHEN** миграция применена к базе с сидом дизайн-системы
- **THEN** тип `gradient` MUST остаться у 5 из 17 сидовых семейств: `text`, `surface` и `outline` /
  `accent-gradient`, `surface` / `skeleton-gradient` и `surface` / `skeleton-deep-gradient`
- **THEN** признак `overridden` у всех значений MUST быть `false`

#### Scenario: Сид новой дизайн-системы

- **WHEN** после миграции создаётся дизайн-система или тема из сидов
- **THEN** её определения и значения MUST соответствовать тем же правилам, что и после миграции

### Requirement: Собственное значение платформы

Элемент значения операций цветового токена SHALL иметь необязательное поле `overridden` (по умолчанию `false`).
Для `ios` и `android` `overridden: true` SHALL означать значение, заданное отдельно для платформы, `false` —
значение, построенное клиентом из web. `ds-service` SHALL хранить признак у значения в теме и SHALL возвращать
его в `GET /tenants/{id}/token-values`. Для `web` признак SHALL быть `false`.

#### Scenario: Своё значение Android

- **WHEN** Editor отправляет изменение значений, где у члена `surface.default.accent` значение `android` в
  режиме `dark` передано с `overridden: true`
- **THEN** чтение значений темы MUST вернуть это значение с `overridden: true`, а значения `web` и `ios` — с
  `overridden: false`

#### Scenario: Признак у web

- **WHEN** значение `web` передано с `overridden: true`
- **THEN** API MUST вернуть `400 INVALID_TOKEN_VALUE` и MUST NOT менять значения

#### Scenario: Признак без поля

- **WHEN** элемент значения не содержит `overridden`
- **THEN** API MUST сохранить значение с `overridden: false`

#### Scenario: Нормализация при смене типа

- **WHEN** смена типа семейства переводит сплошное значение `android` с `overridden: true` в слой `color` или
  обратно
- **THEN** признак `overridden` MUST сохраниться

## MODIFIED Requirements

### Requirement: Цветовой токен — семейство определений

`ds-service` SHALL считать цветовым токеном семейство определений одного типа (`color` или `gradient`) с
общими группой и именем: `<group>.<subgroup>.<name>` и `<group>.<subgroup>.<name>-<state>`, где `subgroup` —
`default`, `on-dark`, `on-light`, `inverse`, а для группы `background` — `dark`, `light`, `inverse`; `state` —
`hover`, `active`, `brightness`. Операции над токеном SHALL адресовать семейство любым `tokenId` его члена. Тип
семейства SHALL определяться видом его значений, а не выбором пользователя.

#### Scenario: Семейство по идентификатору члена

- **WHEN** операция получает `tokenId` определения `text.on-dark.accent-hover`
- **THEN** API MUST работать с семейством `text` / `accent` того типа, который хранится у его определений

#### Scenario: Определение вне правила семейства

- **WHEN** имя определения не соответствует правилу семейства
- **THEN** операции над цветовым токеном MUST отклонять его с `400 INVALID_TOKEN_FAMILY`

### Requirement: Изменение значений цветового токена

`ds-service` SHALL предоставлять `PUT /api/ds/tenants/{tenantId}/color-tokens/{tokenId}/values`, которая
заменяет значения переданных членов семейства в текущей теме и в той же транзакции вычисляет тип семейства.

#### Scenario: Успешное изменение

- **WHEN** Editor отправляет актуальный `editRevision` и значения членов `text.default.accent` и
  `text.default.accent-hover`
- **THEN** API MUST заменить значения этих членов в текущей теме переданными
- **THEN** значения других членов семейства, других токенов и других тем MUST NOT измениться, кроме
  нормализации сплошных значений `ios` и `android` при смене типа семейства
- **THEN** API MUST вернуть новый `editRevision` текущей темы и тип семейства `{ editRevision, type }`

#### Scenario: Неполный набор значений члена

- **WHEN** у переданного члена нет значения для какой-либо пары платформы и режима
- **THEN** API MUST вернуть `400 INVALID_TOKEN_FAMILY` и MUST NOT менять значения

#### Scenario: Токен из пути вне семейства

- **WHEN** `tokenId` из пути принадлежит дизайн-системе, но его тип не `color` и не `gradient` или имя вне
  правила семейства
- **THEN** изменение значений и удаление MUST вернуть `400 INVALID_TOKEN_FAMILY`

#### Scenario: Член другого семейства

- **WHEN** запрос содержит `tokenId`, не входящий в семейство токена из пути
- **THEN** API MUST вернуть `400 INVALID_TOKEN_FAMILY` и MUST NOT менять значения

### Requirement: Операции опубликованы в контракте ds-service

Операции SHALL быть описаны в группе `contracts/route-manifest.json` с `origin: ds-service` и в контракте
`openapi/documentation.yaml` с `x-permission: tenants:write`, схемами запросов и ответов и кодами ошибок.
Схема `ColorTokenValueItem` SHALL описывать поле `overridden` и формы значения: цвет, web-градиент и слои
`ios` и `android`; ответ изменения значений SHALL содержать `type`.

#### Scenario: Документ OpenAPI

- **WHEN** `ds-service` отдаёт OpenAPI
- **THEN** документ MUST содержать четыре операции цветового токена — создание, изменение значений,
  удаление и перенос — с их схемами
- **THEN** `ColorTokenValueItem` MUST содержать `overridden`, а ответ изменения значений — `type`
- **THEN** операции манифеста и документа MUST совпадать

#### Scenario: Тесты манифеста db-service

- **WHEN** выполняются тесты манифеста маршрутов db-service
- **THEN** операции MUST пропускаться как операции с `origin: ds-service`

# color-token-operations-api Specification

## Purpose
Определяет операции `ds-service` над отдельным цветовым токеном темы: семейство определений с подгруппами контекста и состояниями, атомарное создание со значениями во всех темах и привязкой к группе палитры, изменение значений членов семейства в одной теме, удаление со значениями во всех темах, сверку и увеличение общей ревизии темы `editRevision` и коды ошибок.
## Requirements
### Requirement: Цветовой токен — семейство определений

`ds-service` SHALL считать цветовым токеном семейство определений одного типа (`color` или `gradient`) с
общими группой и именем: `<group>.<subgroup>.<name>` и `<group>.<subgroup>.<name>-<state>`, где `subgroup` —
`default`, `on-dark`, `on-light`, `inverse`, а для группы `background` — `dark`, `light`, `inverse`; `state` —
`hover`, `active`, `brightness`. Операции над токеном SHALL адресовать семейство любым `tokenId` его члена.

#### Scenario: Семейство по идентификатору члена

- **WHEN** операция получает `tokenId` определения `text.on-dark.accent-hover`
- **THEN** API MUST работать с семейством `text` / `accent` типа `color`

#### Scenario: Определение вне правила семейства

- **WHEN** имя определения не соответствует правилу семейства
- **THEN** операции над цветовым токеном MUST отклонять его с `400 INVALID_TOKEN_FAMILY`

### Requirement: Создание цветового токена

`ds-service` SHALL предоставлять `POST /api/ds/tenants/{tenantId}/color-tokens`, которая в одной транзакции
создаёт все переданные определения семейства, записывает их начальные значения во все темы дизайн-системы
текущей темы и записывает явную привязку токена к группе палитры текущей темы.

#### Scenario: Успешное создание

- **WHEN** Maintainer отправляет актуальный `editRevision`, тип, группу, имя, `paletteGroupId` и членов
  семейства, включая `<group>.default.<name>`, со значениями для `web`, `ios`, `android` в режимах `light` и
  `dark`
- **THEN** API MUST создать определения всех членов в дизайн-системе темы
- **THEN** API MUST записать значения членов в каждую тему дизайн-системы
- **THEN** чтение палитры текущей темы MUST вернуть токен в указанной группе с `assignment: explicit`, а в
  других темах — в группе по умолчанию
- **THEN** API MUST вернуть `201` с новым `editRevision` текущей темы и семейством `{ type, group, name,
  members: [{ tokenId, name }] }`

#### Scenario: Ревизии тем при создании

- **WHEN** токен создан в теме A дизайн-системы с темами A и B
- **THEN** `editRevision` тем A и B MUST увеличиться

#### Scenario: Неполное семейство

- **WHEN** в запросе нет члена `<group>.default.<name>` или у члена нет значения для какой-либо пары
  платформы и режима
- **THEN** API MUST вернуть `400 INVALID_TOKEN_FAMILY` и MUST NOT создавать определения

#### Scenario: Имя занято

- **WHEN** определение с именем любого члена уже есть в дизайн-системе
- **THEN** API MUST вернуть `409 TOKEN_NAME_CONFLICT` и MUST NOT создавать определения

#### Scenario: Недопустимое имя

- **WHEN** группа или имя пустые, имя члена начинается с `light.` или `dark.` или содержит символы вне `a-z`,
  `0-9`, `-`, `.`
- **THEN** API MUST вернуть `400 INVALID_TOKEN_NAME`

#### Scenario: Группа палитры чужой темы

- **WHEN** `paletteGroupId` не принадлежит палитре текущей темы
- **THEN** API MUST вернуть `404` и MUST NOT создавать определения

### Requirement: Изменение значений цветового токена

`ds-service` SHALL предоставлять `PUT /api/ds/tenants/{tenantId}/color-tokens/{tokenId}/values`, которая
заменяет значения переданных членов семейства только в текущей теме.

#### Scenario: Успешное изменение

- **WHEN** Editor отправляет актуальный `editRevision` и значения членов `text.default.accent` и
  `text.default.accent-hover`
- **THEN** API MUST заменить значения этих членов в текущей теме переданными
- **THEN** значения других членов семейства, других токенов и других тем MUST NOT измениться
- **THEN** API MUST вернуть новый `editRevision` текущей темы, а ревизии других тем MUST NOT измениться

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

### Requirement: Удаление цветового токена

`ds-service` SHALL предоставлять `DELETE /api/ds/tenants/{tenantId}/color-tokens/{tokenId}` с телом
`{ editRevision }`, которая в одной транзакции удаляет все определения семейства со значениями во всех темах
и привязками к группам палитры.

#### Scenario: Успешное удаление

- **WHEN** Maintainer удаляет токен с актуальным `editRevision`
- **THEN** API MUST удалить все определения семейства, их значения во всех темах и привязки к группам палитры
- **THEN** API MUST увеличить `editRevision` всех тем дизайн-системы и вернуть ревизию текущей

#### Scenario: Editor удаляет токен

- **WHEN** пользователь с ролью Editor удаляет токен
- **THEN** API MUST вернуть `403` и MUST NOT удалять данные

### Requirement: Общая ревизия темы в операциях токена

Каждая операция над цветовым токеном SHALL сверять `editRevision` текущей темы и увеличивать его в той же
транзакции. Конфликт при параллельном изменении разных токенов одной темы SHALL считаться допустимым.

#### Scenario: Устаревшая ревизия

- **WHEN** `editRevision` запроса не совпадает с ревизией текущей темы
- **THEN** API MUST вернуть `409 TENANT_EDIT_CONFLICT` с актуальным `editRevision`
- **THEN** API MUST NOT менять данные

#### Scenario: Ошибка внутри операции

- **WHEN** любая проверка или запись операции завершилась ошибкой
- **THEN** API MUST NOT сохранять ни определения, ни значения, ни привязки, ни удаления
- **THEN** `editRevision` ни одной темы MUST NOT измениться

### Requirement: Права операций токена

Операции SHALL требовать `tenants:write`; создание — дополнительно `tokens:write`; удаление — дополнительно
`tokens:delete`.

#### Scenario: Viewer меняет значения

- **WHEN** Viewer отправляет изменение значений
- **THEN** API MUST вернуть `403`

#### Scenario: Токен другой дизайн-системы

- **WHEN** `tokenId` не принадлежит дизайн-системе текущей темы или тема не принадлежит проекту
- **THEN** API MUST вернуть `404`

### Requirement: Операции опубликованы в контракте ds-service

Операции SHALL быть описаны в группе `contracts/route-manifest.json` с `origin: ds-service` и в контракте
`openapi/documentation.yaml` с `x-permission: tenants:write`, схемами запросов и ответов и кодами ошибок.

#### Scenario: Документ OpenAPI

- **WHEN** `ds-service` отдаёт OpenAPI
- **THEN** документ MUST содержать три операции цветового токена с их схемами
- **THEN** операции манифеста и документа MUST совпадать

#### Scenario: Тесты манифеста db-service

- **WHEN** выполняются тесты манифеста маршрутов db-service
- **THEN** операции MUST пропускаться как операции с `origin: ds-service`


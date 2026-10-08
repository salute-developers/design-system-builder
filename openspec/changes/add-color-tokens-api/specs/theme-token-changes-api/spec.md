## ADDED Requirements

### Requirement: Изменения токенов темы сохраняются одной операцией

`ds-service` SHALL предоставлять операцию `POST /api/ds/tenants/{tenantId}/token-changes`, которая в одной
транзакции создаёт определения токенов, заменяет значения темы, записывает привязки новых токенов к группам
палитры, удаляет токены и возвращает новый `editRevision` и идентификаторы созданных токенов.

#### Scenario: Успешное сохранение

- **WHEN** Maintainer отправляет актуальный `editRevision`, новый цветовой токен в `create`, существующий
  токен в `delete` и полный набор значений темы, где значения нового токена адресованы `tokenName` и
  `tokenType`
- **THEN** API MUST создать определение нового токена в дизайн-системе темы
- **THEN** API MUST заменить платформенные значения темы переданными, как `PUT /tenants/{id}/token-values`
- **THEN** API MUST удалить определение удаляемого токена вместе с его значениями во всех темах
- **THEN** API MUST вернуть `200` с `editRevision` и `created: [{ name, type, tokenId }]`

#### Scenario: Ошибка на любом шаге

- **WHEN** любая проверка или запись операции завершилась ошибкой
- **THEN** API MUST NOT сохранять ни определения, ни значения, ни привязки, ни удаления
- **THEN** `editRevision` ни одной темы MUST NOT измениться

#### Scenario: Устаревшая ревизия

- **WHEN** `editRevision` запроса не совпадает с ревизией темы
- **THEN** API MUST вернуть `409` с кодом `TENANT_EDIT_CONFLICT` и актуальным `editRevision`

### Requirement: Новый токен получает значения во всех темах дизайн-системы

Операция SHALL копировать значения нового токена выбранной темы во все остальные темы дизайн-системы.

#### Scenario: Дизайн-система с двумя темами

- **WHEN** в теме A создаётся токен со значениями Light и Dark для трёх платформ
- **THEN** тема B MUST получить те же значения для тех же платформ и режимов
- **THEN** ссылка на палитру MUST копироваться без изменений и вычисляться по палитре темы B
- **THEN** `editRevision` темы B MUST увеличиться

#### Scenario: Удаление токена меняет ревизии других тем

- **WHEN** операция удаляет токен, у которого есть значения в теме B
- **THEN** `editRevision` темы B MUST увеличиться

#### Scenario: Изменения без создания и удаления

- **WHEN** запрос содержит только значения
- **THEN** ревизии других тем MUST NOT измениться

### Requirement: Новый токен привязывается к группе палитры темы

Операция SHALL записывать явную привязку нового токена к группе палитры выбранной темы, если в `create`
указан `paletteGroupId`.

#### Scenario: Группа указана

- **WHEN** новый токен создаётся с `paletteGroupId` группы палитры выбранной темы
- **THEN** чтение палитры темы MUST вернуть токен в этой группе с `assignment: explicit`
- **THEN** в других темах токен MUST относиться к группе по умолчанию

#### Scenario: Группа чужой темы

- **WHEN** `paletteGroupId` не принадлежит палитре выбранной темы
- **THEN** API MUST вернуть `400` и MUST NOT сохранять изменения

### Requirement: Операция проверяет права и имена

Операция SHALL требовать `tenants:write`, при непустом `create` — дополнительно `tokens:write`, при непустом
`delete` — дополнительно `tokens:delete`, и SHALL проверять имена и адреса токенов.

#### Scenario: Editor удаляет токен

- **WHEN** пользователь с ролью Editor отправляет непустой `delete`
- **THEN** API MUST вернуть `403` и MUST NOT сохранять изменения

#### Scenario: Имя занято

- **WHEN** имя в `create` совпадает с именем токена дизайн-системы того же типа
- **THEN** API MUST вернуть `409` с кодом `TOKEN_NAME_CONFLICT`

#### Scenario: Недопустимое имя

- **WHEN** имя пустое, начинается с `light.` или `dark.` или содержит символы вне `a-z`, `0-9`, `-`, `.`
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_NAME`

#### Scenario: Недопустимый тип

- **WHEN** тип в `create` не `color` и не `gradient`
- **THEN** API MUST вернуть `400`

#### Scenario: Чужой токен

- **WHEN** `delete` или значение ссылается на токен другой дизайн-системы
- **THEN** API MUST вернуть `400` с кодом `invalid_tenant_token`

#### Scenario: Значение без адреса или с двумя адресами

- **WHEN** у значения нет ни `tokenId`, ни `tokenName` из `create`, либо указаны оба
- **THEN** API MUST вернуть `400`

### Requirement: Операция опубликована в контракте ds-service

Операция SHALL быть описана в группе `contracts/route-manifest.json` с `origin: ds-service` и разрешением
`tenants:write` и SHALL присутствовать в контракте `openapi/documentation.yaml` с `x-permission`, схемами
запроса и ответа и кодами ошибок.

#### Scenario: Документ OpenAPI

- **WHEN** `ds-service` отдаёт OpenAPI
- **THEN** документ MUST содержать `POST /tenants/{id}/token-changes` с `x-permission: tenants:write`,
  `SaveTenantTokenChangesRequest` и `SaveTenantTokenChangesResponse`
- **THEN** операции манифеста и документа MUST совпадать

#### Scenario: Тесты манифеста db-service

- **WHEN** выполняются тесты манифеста маршрутов db-service
- **THEN** операция MUST пропускаться как операция с `origin: ds-service`

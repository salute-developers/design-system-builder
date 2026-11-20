## MODIFIED Requirements

### Requirement: Явный null в полях значения свойства

Операции создания и изменения вариационного и инвариантного значения свойства SHALL принимать `null` в полях `tokenId`, `value`, `alpha` и `adjustment`.

- В изменении (`PATCH`) поле со значением `null` MUST очищаться.
- Поле, отсутствующее в теле, MUST оставаться прежним.
- В создании (`POST`) `null` MUST трактоваться как отсутствие значения поля.
- В изменении поле `stateSetId` со значением `null` MUST отклоняться с `400 invalid_body`, как и прежде.
- Изменение, после которого у значения нет ни токена, ни `value`, MUST отклоняться с `422 property_value_empty`; запись MUST остаться прежней.

#### Scenario: Смена токена с неиспользуемыми полями null

- **WHEN** клиент отправляет `PATCH /variation-property-values/{id}` с телом `{ "tokenId": "<id токена>", "value": null, "adjustment": null }`
- **THEN** `ds-service` MUST ответить `200`
- **THEN** у значения MUST быть новый токен, пустое `value` и пустая корректировка

#### Scenario: Переход с токена на сырое значение

- **WHEN** у значения задан токен, и клиент отправляет `PATCH` с телом `{ "tokenId": null, "value": "48", "adjustment": null }`
- **THEN** `ds-service` MUST ответить `200`
- **THEN** у значения MUST не быть токена, а `value` MUST быть `48`

#### Scenario: Поле не передано

- **WHEN** клиент отправляет `PATCH` с телом `{ "adjustment": "0.5" }`
- **THEN** токен и `value` значения MUST остаться прежними

#### Scenario: Создание значения инварианта

- **WHEN** клиент отправляет `POST /invariant-property-values` с `tokenId`, `"value": null` и `"adjustment": null`
- **THEN** `ds-service` MUST создать значение с этим токеном

#### Scenario: Набор состояний null

- **WHEN** клиент отправляет `PATCH` с `"stateSetId": null`
- **THEN** `ds-service` MUST ответить `400` с кодом `invalid_body`

#### Scenario: Пустое значение после изменения

- **WHEN** у значения задан токен, и клиент отправляет `PATCH` с телом `{ "tokenId": null, "value": null }`
- **THEN** `ds-service` MUST ответить `422` с кодом `property_value_empty`
- **THEN** токен значения MUST остаться прежним

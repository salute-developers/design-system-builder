## ADDED Requirements

### Requirement: Добавление состояния цветового токена

`ds-service` SHALL предоставлять
`POST /api/design-systems/{designSystemId}/tenants/{tenantId}/color-tokens/{tokenId}/states`, которая в одной
транзакции создаёт определения состояния `state` (`hover`, `active` или `brightness`) существующего семейства
`tokenId` и записывает в каждую тему дизайн-системы переданные для неё значения. Операция SHALL требовать
`tenants:write` и `tokens:write`.

#### Scenario: Успешное добавление

- **WHEN** клиент отправляет актуальный `editRevision`, `state: "hover"` и `tenants` — для каждой темы
  дизайн-системы `tenantId` и `members` `<группа>.<подгруппа>.<имя>-hover` для каждой подгруппы, где у семейства
  есть член без состояния, с полными значениями `web`, `ios`, `android` × `light`, `dark` и признаком
  `detached`
- **THEN** API MUST создать определения в группе токенов семейства сразу после его последнего члена
- **THEN** API MUST записать каждой теме её значения вместе с `detached`
- **THEN** `editRevision` всех тем дизайн-системы MUST увеличиться
- **THEN** API MUST вернуть `201` с новым `editRevision` текущей темы, семейством
  `{ type, group, name, members: [{ tokenId, name }] }`, подтверждённой структурой и значениями текущей темы

#### Scenario: Состояние уже есть

- **WHEN** у семейства уже есть определение `<группа>.default.<имя>-<state>`
- **THEN** API MUST вернуть `409 TOKEN_NAME_CONFLICT` и MUST NOT создавать определения

#### Scenario: Неизвестное состояние

- **WHEN** `state` не `hover`, `active` или `brightness`
- **THEN** API MUST вернуть `400 INVALID_TOKEN_STATE`

#### Scenario: Неполный состав

- **WHEN** в `tenants` нет какой-либо темы дизайн-системы или есть чужая тема, состав `members` темы отличается
  от членов состояния или у члена нет значения для пары платформы и режима
- **THEN** API MUST вернуть `400 INVALID_TOKEN_FAMILY` и MUST NOT создавать определения

#### Scenario: Журнал и откат

- **WHEN** состояние добавлено в активный черновик
- **THEN** журнал черновика MUST содержать создание его определений и значений
- **WHEN** пользователь откатывает создание определения состояния
- **THEN** определение и его значения во всех темах MUST исчезнуть из активного чтения

### Requirement: Удаление состояния цветового токена

`ds-service` SHALL предоставлять
`DELETE /api/design-systems/{designSystemId}/tenants/{tenantId}/color-tokens/{tokenId}/states/{state}` с телом
`{ editRevision }`, которая удаляет определения состояния во всех подгруппах семейства, их значения во всех
темах и привязки к группам палитры, сохраняя данные опубликованных версий. Операция SHALL требовать
`tenants:write` и `tokens:delete`.

#### Scenario: Успешное удаление

- **WHEN** Maintainer удаляет состояние `active` токена `text.accent`
- **THEN** определения `text.<подгруппа>.accent-active` всех подгрупп, их значения и привязки MUST исчезнуть из
  активного чтения атомарно
- **THEN** члены без состояния и другие состояния MUST остаться
- **THEN** `editRevision` всех тем MUST увеличиться, а ответ MUST совпадать по форме с ответом удаления токена

#### Scenario: Состояния нет

- **WHEN** у семейства нет определения `<группа>.default.<имя>-<state>`
- **THEN** API MUST вернуть `404`

#### Scenario: Editor удаляет состояние

- **WHEN** пользователь без `tokens:delete` удаляет состояние
- **THEN** API MUST вернуть `403` и MUST NOT удалять данные

### Requirement: Операции состояний опубликованы в контракте ds-service

Операции добавления и удаления состояния SHALL быть описаны в
`backend-kt/ds-service/runtime/src/main/resources/openapi/documentation.yaml` с телами запросов, ответами и
кодами ошибок.

#### Scenario: Контрактная проверка

- **WHEN** выполняется контрактная проверка OpenAPI `ds-service`
- **THEN** маршруты `.../color-tokens/{tokenId}/states` и `.../color-tokens/{tokenId}/states/{state}` MUST
  совпадать с реализацией

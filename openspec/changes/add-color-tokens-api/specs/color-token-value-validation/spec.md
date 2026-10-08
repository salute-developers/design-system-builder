## ADDED Requirements

### Requirement: Значения цветовых токенов проверяются при записи

`ds-service` SHALL проверять значения токенов типа `color` в `POST /tenants/{id}/token-changes` и
`PUT /tenants/{id}/token-values` и SHALL отклонять весь запрос с `400 INVALID_TOKEN_VALUE` при первом
недопустимом значении.

#### Scenario: HEX

- **WHEN** значение — строка или массив из одной строки `#RGB`, `#RRGGBB` или `#RRGGBBAA`
- **THEN** API MUST принять значение

#### Scenario: Ссылка на ступень палитры темы

- **WHEN** значение — `[type.shade.step]` или `[type.shade.step][o]`, где `o` от 0 до 1, а ступень есть в
  копии шаблона палитры темы
- **THEN** API MUST принять значение

#### Scenario: Ссылка на отсутствующую ступень

- **WHEN** ступени ссылки нет в копии шаблона палитры темы
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_VALUE` и адресом значения
  `<tokenId или имя>:<platform>:<mode>` в `message`

#### Scenario: Форма `paletteId`

- **WHEN** у значения указан `paletteId`, а `value` — `null`, `[]` или массив из одной строки с числом от 0
  до 1
- **THEN** API MUST принять значение

#### Scenario: Произвольная строка

- **WHEN** значение цветового токена не HEX, не ссылка и не форма `paletteId`
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_VALUE`
- **THEN** API MUST NOT изменять значения темы

### Requirement: Значения градиентных токенов проверяются при записи

`ds-service` SHALL проверять web-значения токенов типа `gradient` теми же операциями.

#### Scenario: Допустимый градиент

- **WHEN** web-значение — массив строк, каждая из которых `linear-gradient(...)`, `radial-gradient(...)`,
  `conic-gradient(...)` или HEX
- **THEN** API MUST принять значение

#### Scenario: Недопустимый градиент

- **WHEN** web-значение не массив строк или строка не градиент и не HEX
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_VALUE`

#### Scenario: Значения ios и android

- **WHEN** значение градиента для `ios` или `android` — массив
- **THEN** API MUST принять значение без проверки структуры элементов

### Requirement: Значения других типов не проверяются

`ds-service` SHALL NOT применять проверку цвета к значениям токенов, тип которых не `color` и не `gradient`.

#### Scenario: Значение типографики

- **WHEN** пакет содержит значение токена `typography`
- **THEN** API MUST сохранить его без проверки формата цвета

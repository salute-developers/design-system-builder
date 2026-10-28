# color-token-value-validation Specification

## Purpose
Определяет проверку значений цветовых и градиентных токенов в `ds-service` при записи: HEX, ссылки на ступени копии палитры темы с прозрачностью, градиенты web и массивы ios и android, отказ `INVALID_TOKEN_VALUE` с адресом значения без частичных изменений.
## Requirements
### Requirement: Значения цветовых токенов проверяются при записи

`ds-service` SHALL проверять значения токенов типа `color` и `gradient` в операциях цветового токена
(`POST /tenants/{id}/color-tokens`, `PUT /tenants/{id}/color-tokens/{tokenId}/values`) и
`PUT /tenants/{id}/token-values` и SHALL отклонять весь запрос с `400 INVALID_TOKEN_VALUE` при первом
недопустимом значении. Каждое значение SHALL быть цветом или градиентом. Операции цветового токена SHALL
принимать оба вида значения у любого члена семейства. `PUT /tenants/{id}/token-values` SHALL принимать у токена
типа `color` только цвет, а у токена типа `gradient` — цвет или градиент.

#### Scenario: HEX

- **WHEN** значение — строка или массив из одной строки `#RGB`, `#RRGGBB` или `#RRGGBBAA`
- **THEN** API MUST принять значение как цвет

#### Scenario: Ссылка на ступень палитры темы

- **WHEN** значение — `[type.shade.step]` или `[type.shade.step][o]`, где `o` от 0 до 1, а ступень есть в
  копии шаблона палитры темы
- **THEN** API MUST принять значение как цвет

#### Scenario: Сплошной слой платформы

- **WHEN** значение `ios` или `android` — массив из одного объекта `{ "kind": "color", "background": <цвет> }`,
  где цвет — HEX или ссылка на ступень палитры темы
- **THEN** API MUST принять значение как цвет

#### Scenario: Ссылка на отсутствующую ступень

- **WHEN** ступени ссылки нет в копии шаблона палитры темы
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_VALUE` и адресом значения
  `<tokenId или имя>:<platform>:<mode>` в `details.address`

#### Scenario: Форма `paletteId`

- **WHEN** у значения указан `paletteId`, а `value` — `null`, `[]` или массив из одной строки с числом от 0
  до 1
- **THEN** API MUST принять значение как цвет

#### Scenario: Произвольная строка

- **WHEN** значение не цвет и не градиент
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_VALUE`
- **THEN** API MUST NOT изменять данные

#### Scenario: Градиент в цветовом токене пакетной записью

- **WHEN** `PUT /tenants/{id}/token-values` содержит градиент для токена типа `color`
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_VALUE` и MUST NOT изменять данные

### Requirement: Значения других типов не проверяются

`ds-service` SHALL NOT применять проверку цвета к значениям токенов, тип которых не `color` и не `gradient`.

#### Scenario: Значение типографики

- **WHEN** пакет содержит значение токена `typography`
- **THEN** API MUST сохранить его без проверки формата цвета

### Requirement: Градиентные значения проверяются при записи

`ds-service` SHALL считать градиентом web-значение — массив строк-слоёв, в котором хотя бы один слой является
градиентной функцией, а остальные слои — цвет, и значение `ios` или `android` — массив объектов-слоёв формата
своей платформы, в котором хотя бы один слой не `color`. Градиентная функция SHALL иметь одну из форм:
`linear-gradient(<угол>deg, <стопы>)`, `radial-gradient(<r>% <r>% at <x>% <y>%, <стопы>)` или
`conic-gradient(from <угол>deg at <x>% <y>%, <стопы>)`. Стопы SHALL быть списком из двух и более пар
`<цвет> <позиция>%`, где цвет — `#RRGGBB`, `#RRGGBBAA` или ссылка на ступень палитры темы, а позиции не убывают
и лежат от 0 до 100.

#### Scenario: Допустимый web-градиент

- **WHEN** web-значение — `["conic-gradient(from 90deg at 50% 50%, [general.green.500] 0%, #04C6C9FF 100%)"]`,
  а ступень `general.green.500` есть в копии шаблона палитры темы
- **THEN** API MUST принять значение как градиент

#### Scenario: Сидовый формат угла и позиций

- **WHEN** web-значение — `["linear-gradient(45.00deg, #1A9E32FF 0%, #04C6C9FF 99.688%)"]`
- **THEN** API MUST принять значение как градиент

#### Scenario: Недопустимый web-градиент

- **WHEN** у градиентной функции один стоп, позиции убывают, позиция вне 0–100, угол или центр в другой форме,
  например `to right`, или ссылка стопа указывает на отсутствующую ступень
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_VALUE` и адресом значения

#### Scenario: Слои iOS

- **WHEN** значение `ios` — массив слоёв `linear { locations, colors, angle }`,
  `radial { locations, colors, centerX, centerY, startRadius, endRadius }`,
  `angular { locations, colors, startAngle, endAngle, centerX, centerY }` или `color { background }`
- **THEN** API MUST принять значение, если у каждого слоя есть поле `kind` и все поля своего вида, `colors` и
  `locations` одной длины не меньше двух, `locations` не убывают от 0 до 1, центр от 0 до 1, радиусы не меньше 0,
  а цвета — HEX или ссылки на существующие ступени

#### Scenario: Слои Android

- **WHEN** значение `android` — массив слоёв `linear { locations, colors, angle }`,
  `radial { locations, colors, centerX, centerY, radius }`, `angular { locations, colors, centerX, centerY }` или
  `color { background }`
- **THEN** API MUST принять значение по тем же правилам, что и для iOS

#### Scenario: Слой чужой платформы

- **WHEN** значение `android` содержит слой `radial` с `startRadius` и `endRadius` вместо `radius` или слой
  неизвестного вида
- **THEN** API MUST вернуть `400` с кодом `INVALID_TOKEN_VALUE`


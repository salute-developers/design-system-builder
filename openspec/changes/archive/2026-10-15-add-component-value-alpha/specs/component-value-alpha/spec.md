## ADDED Requirements

### Requirement: Прозрачность значения отдаётся в конфигурации компонента

`GET /legacy/design-systems/{name}/component-configs` SHALL добавлять число `alpha` к значению свойства (инвариант, базовое
значение вариации, значение состояния, значение сочетания), если в базе хранится числовая прозрачность. Если она не задана
или не является числом, поле MUST отсутствовать.

#### Scenario: Инвариант с прозрачностью

- **WHEN** у инварианта `background` хранится `alpha` = `0.2`
- **THEN** запись в `invariantProps` MUST содержать `alpha` = `0.2`.

#### Scenario: Значение состояния с прозрачностью

- **WHEN** у значения состояния `pressed` хранится `alpha` = `0.4`
- **THEN** запись в `states` этого свойства MUST содержать `alpha` = `0.4`.

#### Scenario: Значение без прозрачности

- **WHEN** у значения `alpha` не задан
- **THEN** запись MUST NOT содержать поле `alpha`.

### Requirement: Клиент передаёт прозрачность в payload

Клиент SHALL хранить `alpha` значения в модели конфигурации Compose-компонента и передавать его в payload вместе с цветовым
значением или градиентным токеном, а также у записей состояний. Клиент MUST NOT менять web-превью и панель свойств.

#### Scenario: Градиент с прозрачностью

- **WHEN** у свойства `background` значение `surface.default.accent-gradient` и `alpha` = `0.2`
- **THEN** payload MUST содержать `{ "type": "tokenRef", "tokenId": "surface.default.accent-gradient", "alpha": 0.2 }`.

#### Scenario: Значение без прозрачности

- **WHEN** у значения нет `alpha`
- **THEN** payload MUST NOT содержать поле `alpha` у этого источника.

### Requirement: Превью учитывает прозрачность градиента

Плагин SHALL применять `alpha` источника к градиентному токену так же, как к сплошному цвету. Текст в аватаре MUST быть
виден на полупрозрачном градиентном фоне.

#### Scenario: Аватар с полупрозрачным фоном

- **WHEN** `Avatar` получает фон `surface.default.accent-gradient` с `alpha` = `0.2` и текст `text.default.accent-gradient` без `alpha`
- **THEN** фон MUST рисоваться прозрачнее текста, а надпись MUST быть различима.

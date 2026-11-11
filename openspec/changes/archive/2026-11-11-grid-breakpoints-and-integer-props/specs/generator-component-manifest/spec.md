## ADDED Requirements

### Requirement: Вид по точкам перелома

Манифест компонента SHALL уметь задать `breakpointView: { function, paramSuffix }`. Для каждого стиля, у которого есть значения web-параметров с окончанием `paramSuffix`, генератор SHALL вставлять в CSS стиля вызов функции ядра `function` с объектом «CSS-переменная параметра → значение» и именем стиля, перед значениями стиля.

#### Scenario: Grid

- **WHEN** у Grid в стиле `view.default` есть значения `smallMMinWidth` и `largeMMinWidth`, а манифест задаёт `breakpointView: { function: "getBaseGridView", paramSuffix: "MinWidth" }`
- **THEN** `Grid.config.ts` MUST содержать `${getBaseGridView({ [gridTokens.smallMMinWidth]: '0rem', [gridTokens.largeMMinWidth]: '75rem' }, 'default')};` в стиле `default`
- **THEN** функция MUST импортироваться из `@salutejs/plasma-new-hope/styled-components`

#### Scenario: Компонент без признака

- **WHEN** манифест не задаёт `breakpointView`
- **THEN** конфиг MUST совпадать с прежним

### Requirement: Свойство типа integer

Генератор SHALL записывать значение свойства типа `integer` в конфиг числом без единиц.

#### Scenario: Число колонок

- **WHEN** у Grid свойство `smallMColsCount` типа `integer` со значением `6`
- **THEN** конфиг MUST содержать `${gridTokens.smallMColsCount}: 6;`

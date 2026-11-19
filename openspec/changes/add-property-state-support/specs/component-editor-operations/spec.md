## ADDED Requirements

### Requirement: Набор состояний значения проверяется по признаку свойства

Каждая операция, которая создаёт или меняет значение свойства оформления, SHALL проверять набор состояний этого
значения по правилу допустимого набора из возможности `component-property-state-support`. Проверяемые операции:

- `POST …/invariant-property-values` и `POST …/variation-property-values` — набор `stateSetId` тела;
- `PATCH …/invariant-property-values/{id}` и `PATCH …/variation-property-values/{id}` — набор изменяемой строки по
  текущему признаку свойства;
- `PUT …/appearances/{appearanceId}/property-values` — набор `states` тела, в том числе запись ссылки
  `component_style`.

Набор с состоянием другого компонента SHALL отклоняться ответом `422` с кодом `state_not_in_component`. Набор,
недопустимый по признаку, SHALL отклоняться ответом `422` с кодом `states_not_supported`. В обоих случаях данные MUST
NOT меняться. Признак SHALL читаться в той же транзакции, что и запись, чтобы переимпорт меты между открытием
редактора и автосохранением учитывался.

Следующие операции MUST NOT ограничиваться признаком:

- удаление значения;
- переупорядочивание наборов;
- копирование значений при дублировании конфигурации;
- импорт конфигураций и сиды.

#### Scenario: Автосохранение после переимпорта меты

- **WHEN** редактор открыт, переимпорт меты убрал `hovered` из списка свойства, а вкладка создаёт значение в `hovered` через `POST …/invariant-property-values`
- **THEN** `ds-service` MUST ответить `422` с кодом `states_not_supported`
- **THEN** значения свойства MUST NOT измениться

#### Scenario: Правка существующей строки в недопустимом наборе

- **WHEN** у свойства есть значение в `hovered`, `hovered` нет в списке свойства, и редактор меняет его через `PATCH …/variation-property-values/{id}`
- **THEN** `ds-service` MUST ответить `422` с кодом `states_not_supported`

#### Scenario: Состояние, которого генератор не выражает

- **WHEN** у Compose `Slider.thumbColor` список без `disabled`, и записывается значение в `disabled`
- **THEN** `ds-service` MUST ответить `422` с кодом `states_not_supported`

#### Scenario: Сочетание при запрете сочетаний

- **WHEN** у web-свойства `combinations` равен `false`, и записывается значение в наборе `pressed + hovered`
- **THEN** `ds-service` MUST ответить `422` с кодом `states_not_supported`

#### Scenario: Состояние другого компонента

- **WHEN** значению свойства `CheckBox` передан набор с `checked` компонента `RadioBox`
- **THEN** `ds-service` MUST ответить `422` с кодом `state_not_in_component` при любом признаке свойства

#### Scenario: Допустимый набор

- **WHEN** набор содержит `dragging-over` компонента `DropZone`, и это состояние есть в списке свойства
- **THEN** `ds-service` MUST записать значение

#### Scenario: Признак не задан

- **WHEN** у свойства признак `null`
- **THEN** `ds-service` MUST принять любой набор общих состояний и состояний компонента свойства, как до изменения

#### Scenario: Удаление прежнего значения состояния

- **WHEN** у свойства есть значение в `hovered`, которого нет в списке свойства, и редактор его удаляет
- **THEN** `ds-service` MUST удалить значение

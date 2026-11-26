## MODIFIED Requirements

### Requirement: Value properties are applied but not edited

Свойство типа `value` SHALL применяться в превью как есть и SHALL показываться в панели свойств текстовым
полем, которое сохраняет введённую строку без преобразований.

#### Scenario: Строка уходит в переменную

- **WHEN** свойство `value` имеет значение `fit-content`
- **THEN** соответствующая CSS-переменная в превью MUST получить `fit-content`

#### Scenario: Правка сырого CSS

- **WHEN** пользователь меняет в панели свойств значение `value` на `fit-content`
- **THEN** превью MUST получить `fit-content` в соответствующей CSS-переменной

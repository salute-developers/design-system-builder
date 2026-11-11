## ADDED Requirements

### Requirement: Свойство типа integer в редакторе

Редактор компонента SHALL показывать и сохранять свойства типа `integer` как числа и передавать их в превью числовым литералом.

#### Scenario: Число колонок Grid

- **WHEN** у Grid значение `smallMColsCount` равно `6`
- **THEN** панель свойств MUST показать числовое поле со значением `6`
- **THEN** превью MUST получить значение `6` для `--plasma-grid-smallM-cols-count`

### Requirement: Подписи свойств

Подпись свойства или вариации SHALL разбивать имя на слова по границам регистра и сохранять заглавные сокращения.

#### Scenario: Одиночная заглавная буква

- **WHEN** имя свойства `largeLMinWidth`
- **THEN** подпись MUST быть «Large L min width»
- **WHEN** имя свойства `clearContentMarginLeft`
- **THEN** подпись MUST быть «Clear content margin left»

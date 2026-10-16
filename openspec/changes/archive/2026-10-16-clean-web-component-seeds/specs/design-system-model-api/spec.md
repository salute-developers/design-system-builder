## MODIFIED Requirements

### Requirement: Снимок конфигураций компонентов согласован с глобальными свойствами

Снимок конфигураций компонентов `ds-service` SHALL ссылаться на свойства по именам, принятым в глобальном слое
метаданных после PLASMABLDR-186, и MUST NOT ссылаться на свойства, удалённые из prod-сидов как не имеющие web-параметра.

#### Scenario: Свойство разделителя списка

- **WHEN** загружается снимок `component-seeds.json`
- **THEN** компонент `List` MUST ссылаться на свойство `listItemDividerHeight`
- **AND** имя `listItemDividerWidth` MUST отсутствовать в снимке

#### Scenario: Инициализация на актуальных метаданных

- **GIVEN** глобальные метаданные содержат свойство `List.listItemDividerHeight` и не содержат `listItemDividerWidth`
- **WHEN** проверяется полнота метаданных перед инициализацией конфигураций компонентов
- **THEN** свойство разделителя списка MUST NOT попадать в число отсутствующих метаданных

#### Scenario: Свойства без web-параметра отсутствуют в снимке

- **WHEN** загружается снимок `component-seeds.json`
- **THEN** компоненты `Button`, `Checkbox`, `IconButton` и `Radiobox` MUST NOT ссылаться на свойства, удалённые из prod-сидов (например, `Button.iconColor`, `IconButton.paddingEnd`)
- **AND** инициализация на метаданных чистого prod-сида MUST NOT находить отсутствующих свойств

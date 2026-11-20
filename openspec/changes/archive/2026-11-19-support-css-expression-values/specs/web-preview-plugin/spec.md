## ADDED Requirements

### Requirement: Шаблоны токенов ядра в значениях

Web-плагин SHALL заменять в строковом значении свойства шаблоны `${<объект>.<ключ>}` на значение `<ключ>` из экспорта ядра `<объект>` (имя CSS-переменной), как это делает генератор пакета. Шаблон с неизвестным объектом или ключом SHALL оставаться как есть с предупреждением `incompatible_value`.

#### Scenario: Положение статуса Avatar

- **WHEN** у Avatar значение `statusLeft` равно `calc(var(${avatarTokens.avatarSize}) - var(${avatarTokens.statusIconSize}))`
- **THEN** плагин MUST передать в CSS `calc(var(--plasma-avatar-size) - var(--plasma-avatar-status-icon-size))` с именами переменных из `avatarTokens`

#### Scenario: Неизвестный шаблон

- **WHEN** значение содержит `${unknownTokens.size}`
- **THEN** плагин MUST оставить шаблон как есть и добавить предупреждение `incompatible_value`

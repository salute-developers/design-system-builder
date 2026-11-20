## MODIFIED Requirements

### Requirement: Плагин отклоняет старый формат WEB

Плагин SHALL отвечать `invalid_payload`, если payload содержит корневое поле `web` или значения свойств,
заранее переведённые в CSS, вместо формата общей схемы. CSS-выражение у свойства, найденного в мете компонента, с
числовым параметром (`dimension`, `float`, `integer`) — строка, которая без учёта регистра и начальных пробелов
начинается с `calc(`, `var(`, `min(`, `max(` или `clamp(`, — MUST NOT считаться старым форматом: плагин MUST разрешить
в нём шаблоны токенов ядра и передать его в CSS без перевода в rem, применив шаблон `web-adapter.json`, как к числу.
У свойства, названного ключом ядра и не найденного в мете, такая строка MUST по-прежнему отклоняться.

#### Scenario: Старый payload

- **WHEN** payload содержит корневое поле `web`
- **THEN** плагин MUST ответить `invalid_payload` с путём `$.web`

#### Scenario: Число переведено клиентом

- **WHEN** у `Chip` значение `width` типа `dimension` — литерал `3rem`
- **THEN** плагин MUST ответить `invalid_payload` с путём `$.component.properties.width.base.value`

#### Scenario: Выражение в числовом свойстве

- **WHEN** у `Chip` значение `width` типа `dimension` — литерал `calc(100% - 8px)` или `var(--chip-width)`
- **THEN** плагин MUST принять payload и передать значение в CSS без изменений: шаблона у `width` нет

#### Scenario: Выражение у ключа ядра

- **WHEN** у `Button` есть свойство `buttonWidth` — ключ ядра, которого нет в мете, — со значением `var(--button-width)`
- **THEN** плагин MUST ответить `invalid_payload`

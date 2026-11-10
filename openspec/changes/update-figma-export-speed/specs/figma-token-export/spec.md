## ADDED Requirements

### Requirement: Скорость экспорта

Экспорт SHALL запрашивать значения цветов и градиентов только выбранной платформы и web, а значения `fontFamily` — всех платформ: ссылки на файлы шрифтов есть только у iOS и Android. Повторный экспорт SHALL записывать в документ значение режима переменной, её имя и области применения, только если они отличаются от записанных; значения цвета MUST сравниваться с допуском на точность хранения Figma. Каждое начертание шрифта SHALL загружаться один раз за экспорт.

#### Scenario: Повторный экспорт без изменений

- **WHEN** тема экспортирована и экспорт выполнен снова без изменений в DS Builder
- **THEN** экспорт MUST NOT вызывать запись значения ни для одной переменной

#### Scenario: Изменилось одно значение

- **WHEN** после экспорта в DS Builder изменён цвет одной ступени палитры и экспорт выполнен снова
- **THEN** запись значения MUST произойти только у этой переменной

## MODIFIED Requirements

### Requirement: Цвета темы

Каждый включённый токен `color` и токен `gradient` со сплошными значениями в обоих режимах SHALL становиться переменной `COLOR` в `01. Theme` со значениями режимов `Light` и `Dark` из web. Имя переменной SHALL собираться как `<корень>/<контекст>/<категория>/<имя>`: корень — подпись корневой группы токена со сжатием `" & "` до `"&"`, контекст `Default`, `onDark`, `onLight`, `Inverse` (у группы `background` — `onDark` для `dark`, `onLight` для `light`, без сегмента для `default`), категория — подпись вложенной группы, разбитая по `/`, без подписи `Default`, имя — последний сегмент имени токена в PascalCase; у составной категории из двух и более частей первое слово имени, совпадающее с последней частью категории, отбрасывается. Токены с суффиксом состояния `-hover`, `-active`, `-brightness` SHALL экспортироваться по тому же правилу: суффикс становится частью имени (`PrimaryHover`, `PrimaryActive`, `PrimaryBrightness`) в той же группе, что основной цвет. Выключенные токены MUST NOT экспортироваться.

#### Scenario: Прозрачный акцент

- **WHEN** токен `surface.on-dark.transparent-accent` входит в группу «Surfaces» / «Accent / Transparent»
- **THEN** экспорт MUST создать переменную `Surfaces/onDark/Accent/Transparent/Accent`

#### Scenario: Простая категория

- **WHEN** токен `text.default.accent-minor` входит в группу «Text & Icons» / «Accent»
- **THEN** экспорт MUST создать переменную `Text&Icons/Default/Accent/AccentMinor`

#### Scenario: Фон по умолчанию

- **WHEN** токен `background.default.primary` входит в группу «BG» / «Default»
- **THEN** экспорт MUST создать переменную `BG/Primary`

#### Scenario: Состояние

- **WHEN** у темы есть токены `text.default.primary`, `text.default.primary-hover`, `text.default.primary-active` и `text.default.primary-brightness` в группе «Text & Icons» / «General»
- **THEN** экспорт MUST создать в `01. Theme` переменные `Text&Icons/Default/General/Primary`, `…/PrimaryHover`, `…/PrimaryActive`, `…/PrimaryBrightness`
- **THEN** в `02. SubTheme` MUST появиться переменные `Text&Icons/General/PrimaryHover` и остальные состояния со ссылками на тему своего контекста

#### Scenario: Выключенный токен

- **WHEN** токен выключен в DS Builder
- **THEN** переменная для него MUST NOT создаваться, а отчёт MUST NOT показывать счётчик выключенных токенов

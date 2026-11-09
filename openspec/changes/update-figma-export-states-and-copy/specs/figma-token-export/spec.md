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

#### Scenario: Состояния

- **WHEN** у темы есть токены `text.default.primary`, `text.default.primary-hover`, `text.default.primary-active` и `text.default.primary-brightness` в группе «Text & Icons» / «General»
- **THEN** экспорт MUST создать в `01. Theme` переменные `Text&Icons/Default/General/Primary`, `…/PrimaryHover`, `…/PrimaryActive`, `…/PrimaryBrightness`
- **THEN** в `02. SubTheme` MUST появиться переменные `Text&Icons/General/PrimaryHover` и остальные состояния со ссылками на тему своего контекста

#### Scenario: Выключенный токен

- **WHEN** токен выключен в DS Builder
- **THEN** переменная для него MUST NOT создаваться, а отчёт MUST учитывать его в числе выключенных

### Requirement: Типографика

Экспорт SHALL создавать в `03. Typography` переменные `Font Size`, `Line Height`, `Letter Spacing` в px и `Font Weight` для каждого стиля и варианта начертания со значениями экранов `screen-l`, `screen-m`, `screen-s` в режимах `Large`, `Medium`, `Small`, а также строковые переменные `FontFamily/<Имя>` со шрифтом семейства. Для каждого стиля и варианта SHALL создаваться текстовый стиль с привязкой размера, высоты строки, интервала, насыщенности и семейства к этим переменным. Если шрифта семейства нет в Figma, текстовый стиль SHALL пропускаться с причиной, переменные MUST создаваться, а отчёт SHALL перечислять недостающие семейства и объяснять, что их нужно установить на компьютер и повторить экспорт.

#### Scenario: Заголовок

- **WHEN** у стиля `header.h1` есть вариант `bold` с размером 48 px на `screen-l` и 32 px на `screen-s`
- **THEN** переменная `Header/H1 B/Font Size` MUST иметь значение 48 в режиме `Large` и 32 в режиме `Small`
- **THEN** текстовый стиль `Header/H1 B` MUST быть привязан к этой переменной

#### Scenario: Шрифт не найден

- **WHEN** шрифта `SB Sans Display` нет среди доступных шрифтов Figma
- **THEN** текстовые стили этого семейства MUST быть пропущены с причиной, а переменные типографики MUST быть созданы
- **THEN** отчёт MUST показать подсказку с названием `SB Sans Display` и предложением установить шрифт и повторить экспорт

### Requirement: Размеры и тени

Экспорт SHALL создавать в `04. Numbers` переменные скруглений с областью применения `CORNER_RADIUS` по образцу `DS BUILDER | STYLES`: `CornerRadius/cR<хвост имени>`, для полного скругления — `CornerRadius/Rounded` со значением 1000. Переменная `CornerRadius/null` со значением 0 SHALL быть всегда. Для `cRxxs`, `cRm`, `cRl`, `cRxl` SHALL создаваться внутренний радиус `CornerRadius/calc:[cR<размер>-2]` со значением на 2 меньше, сразу после основного. Экспорт SHALL создавать `Spacing/<хвост имени>` в `05. Spacing` с областью применения `GAP` и стиль эффектов `Shadows/<сегменты имени>` из слоёв тени web.

#### Scenario: Скругления

- **WHEN** у темы есть `round.m` 12 px и `round.circle` с полным скруглением
- **THEN** экспорт MUST создать `CornerRadius/cRm` со значением 12, `CornerRadius/calc:[cRm-2]` со значением 10, `CornerRadius/Rounded` со значением 1000 и `CornerRadius/null` со значением 0

#### Scenario: Тень из двух слоёв

- **WHEN** у тени `down.soft.s` два слоя web
- **THEN** стиль эффектов `Shadows/Down/Soft/S` MUST содержать два `DROP_SHADOW` с теми же смещением, размытием, расширением и цветом

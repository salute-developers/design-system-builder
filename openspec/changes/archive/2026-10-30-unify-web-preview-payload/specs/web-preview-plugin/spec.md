## ADDED Requirements

### Requirement: Web-плагин разрешает payload сам

Web-плагин SHALL переводить payload общего формата в CSS-переменные ядра `@salutejs/plasma-new-hope` сам:
- **ключи токенов ядра** — по API-мете `api-meta.json` своей сборки: каноническое свойство и состояние (`hovered`, `pressed`) → `paramName`;
- **имена CSS-переменных** — по объектам токенов ядра (`<component>Tokens`, исключения `coreTokensByComponent`);
- **значения** — из `literal` и из токенов `theme` по `tokenRef`, с переводом единиц протокола в CSS: px в `rem` по базе 16, `#RRGGBBAA` в цвет CSS, слои теней и градиентов в строки CSS, типографику по её полям в параметры ядра;
- **шаблоны многозначных свойств** — из `web-adapter.json` в бандле плагина (перенесён из `js/cli/.sdds/web`): свойство → `{ключ ядра: шаблон}`, `$1…$n` подставляются значениями;
- **состояния** — из `states` в ключи ядра соответствующего состояния;
- **переменные темы** окружения (`--text-primary`, `--background-primary` и т. п.) — из цветовых токенов `theme`, фон — из `surface.background`, шрифт — из токена шрифта тела;
- **переменные типографики темы** (`--plasma-typo-<токен через дефис без normal>-<поле>`) — из типографических токенов `theme`;
- **производные состояния цвета** — для ключа состояния `hovered`/`pressed` из меты без записи в `states` значение берётся из токена `<tokenId>-hover`/`<tokenId>-active` в `theme`, если он есть.

Клиент SHALL NOT передавать плагину уже переведённые значения.

#### Scenario: Цвет фона кнопки по токену

- **WHEN** payload содержит `component.properties.backgroundColor = {base: {type: "tokenRef", tokenId: "dark.surface.solid.accent"}}`, а в `theme` — этот токен `#2A72F8FF`
- **THEN** плагин MUST задать `--plasma-button-background-color` со значением этого цвета

#### Scenario: Состояние нажатия

- **WHEN** у `backgroundColor` есть запись `states` с `when: ["pressed"]`
- **THEN** плагин MUST задать CSS-переменную ключа ядра, который мета сопоставляет `backgroundColor` и `pressed`

#### Scenario: Размер

- **WHEN** свойство `height` ссылается на токен `dimension` со значением `48`
- **THEN** плагин MUST задать CSS-переменную высоты со значением `3rem`

#### Scenario: Bold у текста

- **WHEN** у `Text` свойство `typoFontWeightBold` — `literal` `var(--plasma-typo-text-m-bold-font-weight)`, а в `theme` есть токен `text.m.bold` с весом 600
- **THEN** плагин MUST задать `--plasma-typo-text-m-bold-font-weight: 600`, и «Text Bold» MUST рисоваться с этим весом

#### Scenario: Наведение без значения состояния

- **WHEN** у `Button.backgroundColor` источник `tokenRef` `dark.surface.default.accent`, в `states` нет `hovered`, а в `theme` есть `dark.surface.default.accent-hover`
- **THEN** плагин MUST задать CSS-переменную ключа наведения из меты значением `dark.surface.default.accent-hover`

#### Scenario: Свойство без параметра в мете

- **WHEN** payload содержит свойство, которого нет в мете для этого компонента
- **THEN** плагин MUST отрисовать компонент без этого свойства и вернуть предупреждение в `success`

### Requirement: Web-плагин собирает связанные компоненты из styles

Плагин SHALL собирать конфиги связанных компонентов story из записей `styles` с `variation`, `name` и
`invariant`: стили по вариациям, инварианты и стили по умолчанию из тех же данных, с переводом значений по
правилам предыдущего требования. Story SHALL получать `relatedComponents` так же, как в пилоте.

#### Scenario: ButtonGroup

- **WHEN** `styles` содержит все стили `Button`
- **THEN** story `ButtonGroup` MUST получить `relatedComponents.Button`, и кнопки MUST иметь CSS-переменные ядра выбранного story стиля

### Requirement: Плагин отклоняет старый формат WEB

Плагин SHALL отвечать `invalid_payload`, если payload содержит корневое поле `web` или значения свойств,
заранее переведённые в CSS, вместо формата общей схемы.

#### Scenario: Старый payload

- **WHEN** payload содержит корневое поле `web`
- **THEN** плагин MUST ответить `invalid_payload` с путём `$.web`

### Requirement: Клиент не содержит web-рендера компонентов

Клиент SHALL NOT содержать отрисовки web-компонентов и перевода конфигов в стили: React-превью,
story (`src/stories`, `useStory`), отображения в CSS-переменные ядра (`coreTokens.ts`), сборки конфигов
темы и связанных компонентов (`createComponentVars`, `createThemeVars`, `createThemeConfig`,
`createRelatedComponents`, `createRelatedComponentVars`, `componentVars.ts`) и зависимости от
`@salutejs/plasma-new-hope` ради превью. Превью web-компонента SHALL рисовать только web-плагин.
Если адрес плагина не задан, манифест недоступен или не перечисляет компонент, область превью SHALL
показывать сообщение о недоступности превью с причиной, а настройка компонента SHALL оставаться доступной.

#### Scenario: Плагин недоступен

- **WHEN** манифест web-плагина не загрузился
- **THEN** область превью MUST показать сообщение «Превью недоступно» с причиной, а панель настройки компонента MUST работать

#### Scenario: Нет React-рендерера

- **WHEN** открыт web-компонент в debug-режиме
- **THEN** редактор MUST NOT предлагать React-превью

### Requirement: Аргументы story не используют имена, запрещённые протоколом

Описание `describe` SHALL NOT содержать свойства `variant` и `appearance`. Аргумент web-story с таким именем
(пропс компонента, например `variant` у `Select`) SHALL описываться псевдонимом (`storyVariant`,
`storyAppearance`), а при отрисовке значение псевдонима SHALL передаваться story под исходным именем.

#### Scenario: Select

- **WHEN** хост запросил `describe` для `Select`
- **THEN** описание MUST содержать `storyVariant`, а не `variant`
- **WHEN** payload содержит `example.props.storyVariant = "tight"`
- **THEN** story MUST получить пропс `variant: "tight"`

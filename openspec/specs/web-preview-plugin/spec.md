# web-preview-plugin Specification

## Purpose
TBD - created by archiving change add-web-preview-plugin-pilot. Update Purpose after archive.
## Requirements
### Requirement: Web-плагин превью — самостоятельное приложение

В репозитории SHALL быть приложение `js/apps/preview-web-plugin`, которое собирается в статический
бандл с `index.html`, `preview-plugin.json` и своими JS и CSS. Плагин SHALL содержать собственные
React, `styled-components`, `@salutejs/plasma-new-hope` и `@salutejs/plasma-icons` и SHALL NOT
импортировать код из `js/apps/client`.

#### Scenario: Сборка плагина

- **WHEN** в `js/apps/preview-web-plugin` выполняется `npm run build`
- **THEN** каталог сборки MUST содержать `index.html`, `preview-plugin.json` и все файлы, на которые они ссылаются

### Requirement: Манифест web-плагина

`preview-plugin.json` SHALL объявлять `schemaVersion: 1`, `platform: "web"`, `protocolVersion: 1`,
точку входа `index.html`, сообщения обмена `sdds.preview.*` в `payloadBridge` и список поддержанных
компонентов `components`. Список SHALL совпадать с реестром компонентов плагина и SHALL содержать `Button`. Рядом с манифестом SHALL лежать
`api-meta.json` — web API-мета, сгенерированная из той же версии `@salutejs/plasma-new-hope`, что входит
в бандл плагина. Манифест SHALL объявлять эту версию в `plasmaNewHopeVersion` и sha256 файла меты
в `apiMetaSha256`.

#### Scenario: Клиент читает манифест

- **WHEN** клиент загружает `preview-plugin.json` web-плагина
- **THEN** манифест MUST проходить проверку клиента для платформы `web`
- **THEN** `components` MUST содержать `Button`

#### Scenario: Мета соответствует бандлу

- **WHEN** проверяется сборка плагина
- **THEN** `apiMetaSha256` MUST совпадать с sha256 `api-meta.json`, а `plasmaNewHopeVersion` — с установленной версией `@salutejs/plasma-new-hope`
- **THEN** `api-meta.json` MUST содержать все компоненты из `components`

### Requirement: Мост сообщений совместим с хостом превью

Плагин SHALL отправлять `sdds.preview.ready` с версией протокола после загрузки и SHALL отвечать на
`sdds.preview.describe` сообщением `sdds.preview.description`, а на `sdds.preview.payload` — сообщением
`sdds.preview.result` с тем же `requestId`, в тех же форматах, что ожидает `ComposePreviewSession`.
Плагин SHALL принимать сообщения только от родительского окна. Ответ SHALL отправляться в origin
отправителя. `success` SHALL отправляться после отрисовки компонента.

#### Scenario: Отрисовка по payload

- **WHEN** хост отправил payload платформы `WEB` для `Button`
- **THEN** плагин MUST отрисовать `Button` и ответить `success` с тем же `requestId`

#### Scenario: Неизвестный компонент

- **WHEN** payload ссылается на компонент, которого нет в реестре плагина
- **THEN** плагин MUST ответить `failure` с кодом `component_not_found`

#### Scenario: Некорректный payload

- **WHEN** payload не соответствует платформе `WEB` или в нём нет обязательных полей
- **THEN** плагин MUST ответить `failure` с кодом `invalid_payload` и причиной

#### Scenario: Ошибка отрисовки

- **WHEN** при отрисовке компонента возникло исключение
- **THEN** плагин MUST ответить `failure` с кодом `render_crashed` и текстом ошибки в `details`

### Requirement: Story Button и её аргументы в плагине

Плагин SHALL содержать story `Button` `Default` с теми же аргументами и отрисовкой, что story клиента:
`disabled`, `isLoading`, `stretching` (`auto`/`filled`/`fixed`), `contentPlacing` (`default`/`relaxed`),
`value`, `text`, `enableContentLeft`, `enableContentRight`, иконки `IconPlasma` и `IconShazam`.
На `describe` плагин SHALL возвращать эти аргументы как описание свойств: логические — `boolean`,
строковые со списком — `singleChoice`, остальные строковые — `string`, со значениями по умолчанию
из story. Значения из `example.props` и имена стилей из `component.variations` SHALL передаваться
story как пропсы.

#### Scenario: Описание story

- **WHEN** хост запросил `describe` для `Button`
- **THEN** плагин MUST вернуть восемь свойств story с типами и значениями по умолчанию

#### Scenario: Изменён аргумент story

- **WHEN** payload содержит `example.props.text = "Купить"`
- **THEN** кнопка MUST отображать текст «Купить»

### Requirement: Локальная раздача web-плагина

Для разработки плагин SHALL раздаваться dev-сервером на отдельном порту (отдельный origin от клиента)
с разрешением CORS для чтения манифеста клиентом. Адрес по умолчанию SHALL быть задан в
`js/docker-compose.dev.yml`.

#### Scenario: Локальный контур

- **WHEN** разработчик поднял клиент и dev-сервер плагина
- **THEN** клиент MUST загрузить манифест и `index.html` плагина по адресу по умолчанию, и origin плагина MUST отличаться от origin клиента

### Requirement: Реестр web-плагина покрывает все web-компоненты с story

Реестр web-плагина SHALL содержать все компоненты, для которых в клиенте есть story (`componentMapper`
в `js/apps/client/src/hooks/useStory.ts`), с их story, аргументами и отрисовкой. Отображение web-параметров
в CSS-переменные ядра SHALL учитывать исключения клиента: объекты токенов ядра не по имени компонента
(`coreTokensByComponent`) и конфиги ядра не по имени компонента (`coreConfigNameByComponent`, например
`Skeleton` → `lineSkeletonConfig`). Манифест SHALL перечислять все компоненты реестра.

#### Scenario: Манифест перечисляет все компоненты

- **WHEN** клиент читает манифест web-плагина
- **THEN** `components` MUST совпадать с ключами реестра плагина и содержать все компоненты `componentMapper` клиента

#### Scenario: Каждый компонент рисуется

- **WHEN** плагин получает базовый payload `WEB` для любого компонента реестра: пустые `properties`, выбранная story по умолчанию, связанные компоненты из реестра
- **THEN** плагин MUST ответить `success` без исключения отрисовки

#### Scenario: Компонент с собственным объектом токенов

- **WHEN** payload для `TabItem` содержит web-параметр, который в ядре описан в `tabsTokens`
- **THEN** плагин MUST задать CSS-переменную из `tabsTokens`, как клиент

### Requirement: Несколько story компонента

Описание компонента SHALL содержать список story `stories: [{id, name}]`. Запрос `describe` SHALL принимать
необязательный `storyId` и возвращать аргументы этой story; без `storyId` — story по умолчанию, первую в списке.
Payload SHALL выбирать story по `example.id`.

#### Scenario: Описание с несколькими story

- **WHEN** хост запросил `describe` для `Tooltip` без `storyId`
- **THEN** описание MUST содержать `stories` с двумя story, `storyId` первой и её аргументы

#### Scenario: Выбор другой story

- **WHEN** хост запросил `describe` для `Tooltip` с `storyId` второй story и отправил payload с этим `example.id`
- **THEN** описание MUST содержать аргументы второй story, а плагин MUST отрисовать вторую story

#### Scenario: Неизвестная story

- **WHEN** `describe` или payload ссылаются на story, которой нет у компонента
- **THEN** плагин MUST ответить `failure` с кодом `story_not_found`

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


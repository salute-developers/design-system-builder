# web-preview-plugin Specification

## Purpose
TBD - created by archiving change add-web-preview-plugin-pilot. Update Purpose after archive.
## Requirements
### Requirement: Web-плагин превью — самостоятельное приложение

Web-плагин SHALL быть приватным пакетом `packages/sdds-preview-web-plugin` (`@salutejs/sdds-preview-web-plugin`)
репозитория plasma, который собирается в статический бандл с `index.html`, `preview-plugin.json` и своими JS и CSS. Плагин SHALL подключать `@salutejs/plasma-new-hope`,
`@salutejs/plasma-b2c` и `@salutejs/plasma-icons` из workspace plasma, SHALL содержать собственные React и
`styled-components` в единственном экземпляре в бандле и SHALL NOT читать файлы и импортировать код репозитория DS Builder. Общие правила маппинга свойств на параметры ядра и данные `web-adapter.json`
плагин SHALL брать из модуля `web-mapping` npm-пакета `@sddsjs/design-system-builder-generator`, объявленного в
`dependencies` точной версией, и SHALL NOT ссылаться на каталог `js/cli` путём.

#### Scenario: Сборка плагина

- **WHEN** в `packages/sdds-preview-web-plugin` выполняется `npm run build`
- **THEN** каталог сборки MUST содержать `index.html`, `preview-plugin.json` и все файлы, на которые они ссылаются

#### Scenario: Нет копии в DS Builder

- **WHEN** проверяется репозиторий DS Builder
- **THEN** в нём MUST NOT быть каталога `js/apps/preview-web-plugin`

### Requirement: Манифест web-плагина

`preview-plugin.json` SHALL объявлять `schemaVersion: 1`, `platform: "web"`, `protocolVersion: 1`,
точку входа `index.html`, сообщения обмена `sdds.preview.*` в `payloadBridge` и список поддержанных
компонентов `components`. Список SHALL совпадать с реестром компонентов плагина и SHALL содержать `Button`. Рядом с манифестом SHALL лежать
`api-meta.json` — web API-мета, построенная при сборке подкомандой `dsbuilder-web-generator api-meta` из
`@salutejs/plasma-new-hope`, установленного в плагине, то есть из той же версии, что входит в бандл. Мета SHALL NOT
храниться в Git. Версия ядра в `plasmaNewHopeVersion` и sha256 файла меты в `apiMetaSha256` SHALL дописываться в
манифест сборки при упаковке из установленного ядра; в закоммиченном `public/preview-plugin.json` этих полей SHALL NOT быть.

#### Scenario: Клиент читает манифест

- **WHEN** клиент загружает `preview-plugin.json` web-плагина
- **THEN** манифест MUST проходить проверку клиента для платформы `web`
- **THEN** `components` MUST содержать `Button`

#### Scenario: Мета соответствует бандлу

- **WHEN** проверяется архив, собранный `npm run package`
- **THEN** `apiMetaSha256` MUST совпадать с sha256 `api-meta.json`, а `plasmaNewHopeVersion` — с установленной версией `@salutejs/plasma-new-hope`
- **THEN** `api-meta.json` MUST содержать все компоненты из `components`

#### Scenario: Мета строится перед сборкой, разработкой и тестами

- **WHEN** в `packages/sdds-preview-web-plugin` выполняется `npm run build`, `npm run dev` или `npm test` на чистом клоне plasma с собранным ядром
- **THEN** перед запуском MUST быть построен `public/api-meta.json` из установленного ядра
- **THEN** построенная мета MUST побайтно совпадать с результатом `dsbuilder-web-generator api-meta` для того же собранного ядра

### Requirement: Мост сообщений совместим с хостом превью

Плагин SHALL отправлять `sdds.preview.ready` с версией протокола после загрузки и SHALL отвечать на
`sdds.preview.describe` сообщением `sdds.preview.description`, а на `sdds.preview.payload` — сообщением
`sdds.preview.result` с тем же `requestId`, в тех же форматах, что ожидает `ComposePreviewSession`.
Плагин SHALL принимать сообщения только от родительского окна. Ответ SHALL отправляться в origin
отправителя. `success` SHALL отправляться после отрисовки компонента и завершения подготовки шрифтов темы.

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
с разрешением CORS для чтения манифеста клиентом (`npm run dev` пакета в plasma, порт 3011). Адрес по умолчанию SHALL быть задан в
`js/docker-compose.dev.yml` DS Builder.

#### Scenario: Локальный контур

- **WHEN** разработчик поднял клиент и dev-сервер плагина
- **THEN** клиент MUST загрузить манифест и `index.html` плагина по адресу по умолчанию, и origin плагина MUST отличаться от origin клиента

### Requirement: Реестр web-плагина покрывает все web-компоненты с story

Реестр web-плагина SHALL содержать web-компоненты с story, аргументами и отрисовкой; список SHALL поддерживаться в
плагине и SHALL NOT сверяться тестами с кодом клиента DS Builder. Отображение web-параметров
в CSS-переменные ядра SHALL учитывать объекты токенов и конфиги ядра не по имени компонента (`TabItem` → `tabsTokens`,
`Skeleton` → `lineSkeletonConfig`). Имена SHALL браться функциями `coreTokensExportName` и `coreConfigExportName`
модуля `web-mapping` по манифестам генератора из подкоманды `manifests`; собственных таблиц соответствий плагин SHALL NOT
содержать. Манифест SHALL перечислять все компоненты реестра.

#### Scenario: Манифест перечисляет все компоненты

- **WHEN** клиент читает манифест web-плагина
- **THEN** `components` MUST совпадать с ключами реестра плагина в том же порядке

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

Web-плагин SHALL переводить payload общего формата в CSS-переменные ядра `@salutejs/plasma-new-hope` сам. Данные `web-adapter.json`, типы API-меты, суффиксы ключей состояний, подстановку шаблонов, `compose`-связи, перевод px в `rem` и радиус с поправкой, поле типографики, основу имени переменных типографики темы, имя объекта ядра компонента по манифестам генератора, имя переменной цвета темы и суффиксы производных токенов плагин SHALL брать из модуля `web-mapping` пакета генератора и SHALL NOT реализовывать их сам. Выбор параметра состояния по мете и шаблона по конфигурациям остаётся правилом плагина:
- **ключи токенов ядра** — по API-мете `api-meta.json` своей сборки: каноническое свойство и состояние (`hovered`, `pressed`) → `paramName`;
- **имена CSS-переменных** — по объектам токенов ядра (`<component>Tokens`, исключения — по `coreTokensExport` манифестов генератора из подкоманды `manifests`);
- **значения** — из `literal` и из токенов `theme` по `tokenRef`, с переводом единиц протокола в CSS: px в `rem` по базе 16, `#RRGGBBAA` в цвет CSS, слои теней и градиентов в строки CSS, типографику по её полям в параметры ядра;
- **шаблоны многозначных свойств** — из `web-adapter.json` пакета генератора: свойство → `{ключ ядра: шаблон}`, `$1…$n` подставляются значениями;
- **состояния** — из `states` в ключи ядра соответствующего состояния;
- **переменные темы** окружения (`--text-primary`, `--background-primary` и т. п.) — из цветовых токенов `theme`, фон — из `surface.background`, шрифт — из токена шрифта тела;
- **переменные типографики темы** (`--plasma-typo-<основа>-<поле>`, основа — по правилу генератора тем: `display` → `dspl`, группа `header` и вес `normal` опускаются) — из типографических токенов `theme`;
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

#### Scenario: Типографика заголовка

- **WHEN** в `theme` есть типографический токен `header.h3.bold`, а значение свойства Calendar — `var(--plasma-typo-h3-bold-font-weight)`
- **THEN** плагин MUST объявить `--plasma-typo-h3-bold-font-weight`, и значение MUST разрешиться

#### Scenario: В плагине нет копий общих данных и правил

- **WHEN** проверяется исходный код `packages/sdds-preview-web-plugin` репозитория plasma
- **THEN** в нём MUST NOT быть файла `web-adapter.json`, закоммиченного `api-meta.json` и собственных реализаций подстановки шаблонов, перевода px в `rem`, выбора поля типографики, имён переменных цвета и типографики темы, таблиц объектов ядра по компонентам
- **THEN** эти функции MUST импортироваться из `@sddsjs/design-system-builder-generator/web-mapping`

### Requirement: Web-плагин собирает связанные компоненты из styles

Плагин SHALL собирать конфиги связанных компонентов story из записей `styles` с `variation`, `name` и
`invariant`: стили по вариациям, инварианты и стили по умолчанию из тех же данных, с переводом значений по
правилам предыдущего требования. Story SHALL получать `relatedComponents` так же, как в пилоте.

#### Scenario: ButtonGroup

- **WHEN** `styles` содержит все стили `Button`
- **THEN** story `ButtonGroup` MUST получить `relatedComponents.Button`, и кнопки MUST иметь CSS-переменные ядра выбранного story стиля

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

### Requirement: Web-плагин дожидается шрифтов темы

Плагин SHALL запрашивать загрузку каждого начертания токенов `fontFamily` и SHALL отвечать на payload только после
завершения всех загрузок, но не позже чем через 5 секунд. Начертание, не загруженное за это время или с ошибкой,
SHALL считаться недоступным.

#### Scenario: Шрифт загружается

- **WHEN** загрузка начертания ещё не завершена
- **THEN** плагин MUST NOT отправлять `success` до её завершения

#### Scenario: Подмена шрифта разрешена

- **WHEN** начертание недоступно и у токена `allowFallback: true`
- **THEN** плагин MUST ответить `success` с warning `font_fallback` и путём токена

#### Scenario: Подмена шрифта не разрешена

- **WHEN** начертание недоступно и у токена нет `allowFallback: true`
- **THEN** плагин MUST ответить `failure` с кодом `font_unavailable` и путём токена

#### Scenario: Загрузка зависла

- **WHEN** загрузка начертания не завершилась за 5 секунд
- **THEN** плагин MUST ответить так же, как при ошибке загрузки, до истечения таймаута хоста

### Requirement: Web-плагин использует настоящее имя шрифта

Плагин SHALL называть семейство в `@font-face` значением `family` токена, а без него — идентификатором токена.
Значения свойства `font-family` SHALL содержать запасное семейство `sans-serif`.
Токены с разными файлами шрифтов SHALL отображаться разными семействами, даже если их `family` совпадает.

#### Scenario: Имя задано

- **WHEN** токен `fontFamily.body` содержит `family: "SB Sans Text"`
- **THEN** `@font-face` MUST объявлять семейство `"SB Sans Text"`, а шрифт области превью MUST быть `"SB Sans Text", sans-serif`

#### Scenario: Имя не задано

- **WHEN** токен `fontFamily.body` не содержит `family`
- **THEN** `@font-face` MUST объявлять семейство `"fontFamily.body"`, а шрифт области превью MUST быть `"fontFamily.body", sans-serif`

#### Scenario: Одно имя, одинаковые файлы

- **WHEN** два токена содержат одно `family` и одинаковые файлы, веса и стили
- **THEN** оба MUST использовать это имя, а правила `@font-face` MUST NOT повторяться

#### Scenario: Одно имя, разные файлы

- **WHEN** два токена содержат одно `family` и разные файлы
- **THEN** первый токен MUST использовать это имя, а второй MUST использовать своё имя токена со своими файлами

### Requirement: Шаблоны токенов ядра в значениях

Web-плагин SHALL заменять в строковом значении свойства шаблоны `${<объект>.<ключ>}` на значение `<ключ>` из экспорта ядра `<объект>` (имя CSS-переменной), как это делает генератор пакета. Шаблон с неизвестным объектом или ключом SHALL оставаться как есть с предупреждением `incompatible_value`.

#### Scenario: Положение статуса Avatar

- **WHEN** у Avatar значение `statusLeft` равно `calc(var(${avatarTokens.avatarSize}) - var(${avatarTokens.statusIconSize}))`
- **THEN** плагин MUST передать в CSS `calc(var(--plasma-avatar-size) - var(--plasma-avatar-status-icon-size))` с именами переменных из `avatarTokens`

#### Scenario: Неизвестный шаблон

- **WHEN** значение содержит `${unknownTokens.size}`
- **THEN** плагин MUST оставить шаблон как есть и добавить предупреждение `incompatible_value`


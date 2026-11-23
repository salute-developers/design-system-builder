## MODIFIED Requirements

### Requirement: Web-плагин превью — самостоятельное приложение

В репозитории SHALL быть приложение `js/apps/preview-web-plugin`, которое собирается в статический
бандл с `index.html`, `preview-plugin.json` и своими JS и CSS. Плагин SHALL содержать собственные
React, `styled-components`, `@salutejs/plasma-new-hope` и `@salutejs/plasma-icons` и SHALL NOT
импортировать код из `js/apps/client`. Общие правила маппинга свойств на параметры ядра и данные `web-adapter.json`
плагин SHALL брать из модуля `web-mapping` npm-пакета `@sddsjs/design-system-builder-generator`, объявленного в
`dependencies` точной версией, и SHALL NOT ссылаться на каталог `js/cli` путём.

#### Scenario: Сборка плагина

- **WHEN** в `js/apps/preview-web-plugin` выполняется `npm run build`
- **THEN** каталог сборки MUST содержать `index.html`, `preview-plugin.json` и все файлы, на которые они ссылаются

### Requirement: Манифест web-плагина

`preview-plugin.json` SHALL объявлять `schemaVersion: 1`, `platform: "web"`, `protocolVersion: 1`,
точку входа `index.html`, сообщения обмена `sdds.preview.*` в `payloadBridge` и список поддержанных
компонентов `components`. Список SHALL совпадать с реестром компонентов плагина и SHALL содержать `Button`. Рядом с манифестом SHALL лежать
`api-meta.json` — web API-мета, построенная при сборке подкомандой `dsbuilder-web-generator api-meta` из
`@salutejs/plasma-new-hope`, установленного в плагине, то есть из той же версии, что входит в бандл. Мета SHALL NOT
храниться в Git. Манифест SHALL объявлять эту версию в `plasmaNewHopeVersion`; sha256 файла меты в `apiMetaSha256`
SHALL дописываться в манифест сборки при упаковке.

#### Scenario: Клиент читает манифест

- **WHEN** клиент загружает `preview-plugin.json` web-плагина
- **THEN** манифест MUST проходить проверку клиента для платформы `web`
- **THEN** `components` MUST содержать `Button`

#### Scenario: Мета соответствует бандлу

- **WHEN** проверяется архив, собранный `npm run package`
- **THEN** `apiMetaSha256` MUST совпадать с sha256 `api-meta.json`, а `plasmaNewHopeVersion` — с установленной версией `@salutejs/plasma-new-hope`
- **THEN** `api-meta.json` MUST содержать все компоненты из `components`

#### Scenario: Мета строится перед сборкой, разработкой и тестами

- **WHEN** в `js/apps/preview-web-plugin` выполняется `npm run build`, `npm run dev` или `npm test` на чистом клоне
- **THEN** перед запуском MUST быть построен `public/api-meta.json` из установленного ядра
- **THEN** построенная мета MUST побайтно совпадать с результатом `npm run generate:api-meta -- --package @salutejs/plasma-new-hope` в `js/cli` при той же версии ядра

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

- **WHEN** проверяется исходный код `js/apps/preview-web-plugin`
- **THEN** в нём MUST NOT быть файла `web-adapter.json`, закоммиченного `api-meta.json` и собственных реализаций подстановки шаблонов, перевода px в `rem`, выбора поля типографики, имён переменных цвета и типографики темы, таблиц объектов ядра по компонентам
- **THEN** эти функции MUST импортироваться из `@sddsjs/design-system-builder-generator/web-mapping`

### Requirement: Реестр web-плагина покрывает все web-компоненты с story

Реестр web-плагина SHALL содержать все компоненты, для которых в клиенте есть story (`componentMapper`
в `js/apps/client/src/hooks/useStory.ts`), с их story, аргументами и отрисовкой. Отображение web-параметров
в CSS-переменные ядра SHALL учитывать объекты токенов и конфиги ядра не по имени компонента (`TabItem` → `tabsTokens`,
`Skeleton` → `lineSkeletonConfig`). Имена SHALL браться функциями `coreTokensExportName` и `coreConfigExportName`
модуля `web-mapping` по манифестам генератора из подкоманды `manifests`; собственных таблиц соответствий плагин SHALL NOT
содержать. Манифест SHALL перечислять все компоненты реестра.

#### Scenario: Манифест перечисляет все компоненты

- **WHEN** клиент читает манифест web-плагина
- **THEN** `components` MUST совпадать с ключами реестра плагина и содержать все компоненты `componentMapper` клиента

#### Scenario: Каждый компонент рисуется

- **WHEN** плагин получает базовый payload `WEB` для любого компонента реестра: пустые `properties`, выбранная story по умолчанию, связанные компоненты из реестра
- **THEN** плагин MUST ответить `success` без исключения отрисовки

#### Scenario: Компонент с собственным объектом токенов

- **WHEN** payload для `TabItem` содержит web-параметр, который в ядре описан в `tabsTokens`
- **THEN** плагин MUST задать CSS-переменную из `tabsTokens`, как клиент

## REMOVED Requirements

### Requirement: Web-адаптер плагина совпадает с копией CLI

**Reason**: копия `web-adapter.json` в плагине удаляется, плагин берёт данные из модуля `web-mapping` пакета генератора.

**Migration**: шаблоны новых компонентов дописываются только в `js/cli/src/data/web-adapter.json`; плагин получает их с новой версией пакета генератора.

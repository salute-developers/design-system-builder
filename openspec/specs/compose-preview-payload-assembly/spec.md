# compose-preview-payload-assembly Specification

## Purpose
Сборка нейтральной модели превью в запрос Compose с разрешением темы, вариаций, свойств и состояний.
## Requirements
### Requirement: Client формирует нейтральный preview draft

`apps/client` SHALL преобразовывать текущее полное состояние component editor в
JSON-compatible `ComponentPreviewDraft`, не передавая controller classes, React state objects
или CSS variables в payload assembler.

#### Scenario: Draft отражает текущее состояние редактора

- **WHEN** editor имеет component config, theme, selected styles, example props, mode и surface
- **THEN** adapter MUST включить их актуальные значения и revision markers в draft
- **AND** draft MUST содержать явные renderer platform и theme-value platform.

#### Scenario: Platform metadata недоступна

- **WHEN** component/property не имеет stable preview ID либо Compose platform mapping
- **THEN** adapter MUST вернуть структурированную diagnostic
- **AND** client MUST NOT выводить ID из display name или CSS variable.

### Requirement: Variation selections не имеют фиксированной семантики

Draft adapter SHALL собирать selection каждого variation axis из runtime config и SHALL
отделять variation selections от example props без списка известных axis names.

#### Scenario: Дизайн-система добавила пользовательскую variation

- **WHEN** config содержит новый variation axis и пользователь выбрал его style
- **THEN** draft MUST сохранить variation ID и выбранный style ID
- **AND** assembler MUST включить properties выбранного style без изменения своего кода.

#### Scenario: Story prop не является variation

- **WHEN** editor control отсутствует в runtime списке variations
- **THEN** его значение MUST попасть в `example.props`
- **AND** оно MUST NOT интерпретироваться как style selection.

### Requirement: Assembler формирует effective Compose properties

`ComposePreviewPayloadAssembler` SHALL формировать `payload.component.properties` из
invariants и properties всех выбранных styles, сохраняя канонические component property names,
для платформы компонента: `COMPOSE` или `WEB`. Платформа SHALL определять `payload.platform`,
значения какой платформы берутся у токенов темы (`android` для `COMPOSE`, `web` для `WEB`) и по
параметрам какой платформы отбираются свойства: property без параметра этой платформы, но с
параметрами других платформ, SHALL пропускаться, а без параметров вовсе — давать `missing_mapping`.
Assembler MUST NOT интерпретировать имена платформенных параметров как ключи payload и MUST NOT
переводить значения в формат платформы (CSS-строки, единицы `rem`, ключи токенов библиотеки).

#### Scenario: Property с token reference

- **WHEN** selected или invariant property ссылается на theme token и доступна для платформы компонента
- **THEN** её каноническое property name MUST получить `tokenRef` с исходным token ID.

#### Scenario: Property с literal и состояниями

- **WHEN** property содержит literal base и значения для состояний
- **THEN** assembler MUST нормализовать base и записать каждое значение состояния отдельной
  записью упорядоченного массива `states` вида `{when, source}`
- **AND** порядок записей MUST совпадать с порядком состояний в draft.

#### Scenario: Property содержит adjustment

- **WHEN** effective property использует поддержанный adjustment, который Preview Protocol v1
  не моделирует отдельно
- **THEN** assembler MUST применить adjustment до сериализации
- **AND** property source MUST стать нормализованным effective literal.

#### Scenario: Разные properties используют общий platform parameter

- **WHEN** `paddingStart` и `paddingEnd` имеют общий Compose platform parameter `paddings`
- **THEN** payload MUST содержать независимые properties `paddingStart` и `paddingEnd`
- **AND** assembler MUST NOT считать общий platform parameter конфликтом.

#### Scenario: Канонические component properties конфликтуют

- **WHEN** effective properties с разными stable property IDs объявляют одно каноническое
  property name с несовместимыми sources
- **THEN** assembler MUST завершиться diagnostic
- **AND** diagnostic MUST указать property name и оба source property IDs
- **AND** MUST NOT выбирать значение по last-write-wins.

#### Scenario: Variations переопределяют одну property

- **WHEN** одна stable property присутствует в нескольких выбранных styles
- **THEN** assembler MUST применить более позднее значение в порядке variations из config
- **AND** это MUST NOT считаться конфликтом component properties
- **AND** theme closure MUST содержать только token references итогового значения property.

#### Scenario: Web-компонент

- **WHEN** ассемблер собирает payload для web `Button` в тёмном режиме
- **THEN** `payload.platform` MUST быть `WEB`, токены темы MUST содержать web-значения в единицах протокола (размеры — числа в px, цвета — `#RRGGBBAA`)
- **AND** свойства без web-параметра MUST быть пропущены, а не дать `missing_mapping`

### Requirement: Assembler разрешает транзитивную тему

Assembler SHALL включать нормализованные values всех theme tokens, транзитивно необходимых
effective properties, используя явно выбранные mode и theme-value platform без скрытого
fallback.

#### Scenario: Простая token reference

- **WHEN** component property ссылается на color, dimension или shape token
- **THEN** payload theme MUST содержать normalized value под тем же token ID.

#### Scenario: Typography зависит от font family

- **WHEN** component property ссылается на typography token
- **THEN** payload MUST содержать typography value и referenced font-family value
- **AND** payload assets MUST содержать descriptors всех обязательных font faces.

#### Scenario: Token отсутствует или выключен

- **WHEN** referenced token не имеет допустимого value для выбранных mode/platform либо disabled
- **THEN** assembler MUST вернуть diagnostic с token ID
- **AND** MUST NOT использовать значение другой platform или mode.

#### Scenario: Theme reference образует цикл

- **WHEN** транзитивный token graph содержит cycle
- **THEN** assembler MUST завершиться diagnostic с reference path
- **AND** MUST NOT формировать частичный payload.

### Requirement: Assembled payload input соответствует Preview Protocol v1

Успешный результат assembler SHALL быть typed
`PreviewPayloadInput = Omit<PreviewPayload, "requestId">`. `ComposePreviewSession` SHALL добавить
уникальный `requestId`, после чего полный wire payload SHALL проходить canonical Preview
Protocol v1 JSON Schema.

#### Scenario: Полный Button payload собран

- **WHEN** Button draft содержит валидные component properties, theme references, example и
  surface
- **THEN** payload input MUST содержать protocol version 1, platform `COMPOSE`, component ID,
  variation context, effective properties, normalized theme, assets, example и surface
- **AND** после добавления session `requestId` wire payload MUST пройти canonical schema
  validation.

#### Scenario: Request correlation назначает host

- **WHEN** assembled payload input передаётся `ComposePreviewFrame`
- **THEN** `ComposePreviewSession` MUST назначить новый `requestId`
- **AND** session MUST сформировать полный typed `PreviewPayload`
- **AND** assembler MUST NOT управлять pending requests или iframe lifecycle.

### Requirement: Editor использует assembled payload в production preview

`ComponentEditorPreview` SHALL использовать assembled payload вместо canonical Button fixture
для Compose renderer.

#### Scenario: Theme или component изменён

- **WHEN** пользователь изменяет referenced theme token, component property, state value либо
  variation selection
- **THEN** editor MUST собрать и отправить новый полный payload
- **AND** существующий iframe MUST обновить Compose component без reload.

#### Scenario: Example или surface изменён

- **WHEN** пользователь изменяет story prop, theme mode или preview surface
- **THEN** editor MUST собрать и отправить новый полный payload с актуальными example/surface
  values.

#### Scenario: Assembly завершилась ошибкой

- **WHEN** assembler возвращает diagnostic
- **THEN** client MUST NOT отправлять частичный payload
- **AND** последний успешный Compose render и React renderer MUST оставаться доступными.

### Requirement: Compose example props ограничены story description

Draft adapter SHALL получать Compose example props отдельно от variation selections и SHALL
включать только properties совместимого `PreviewComponentDescription`.

#### Scenario: Story property поддерживается plugin

- **WHEN** пользователь изменяет control, присутствующий в component description
- **THEN** его typed value MUST попасть в `payload.example.props`
- **AND** новый payload MUST сохранить component variation selections отдельно.

#### Scenario: Значение не описано story

- **WHEN** client state содержит property, отсутствующий в актуальном component description
- **THEN** draft MUST исключить его из Compose `example.props`.

#### Scenario: Property является variation field

- **WHEN** property name равно `variant` или `appearance` либо соответствует variation selection
- **THEN** client MUST NOT включать его в Compose `example.props`.

### Requirement: Assembler передаёт расширенные источники только из draft

Assembler SHALL формировать наборы состояний, `alpha`, `styleRef`, `assetRef`, словарь `styles`,
gradient и shadow `spread` только тогда, когда `ComponentPreviewDraft` содержит соответствующие
данные. Assembler MUST NOT выводить эти данные из display names, CSS variables или значений
по умолчанию. Контроллеры `Config` и `Theme` в этом изменении SHALL остаться без изменений.

#### Scenario: Draft не содержит расширенных данных

- **WHEN** draft содержит только цвета, размеры, формы, типографику и состояния из одного имени
- **THEN** payload MUST содержать для каждого состояния запись `when` из одного имени
- **AND** payload MUST NOT содержать `alpha`, `styleRef`, `assetRef`, `styles` и gradient-токены.

#### Scenario: Draft содержит составное состояние

- **WHEN** draft описывает значение для набора состояний `pressed` и `selected`
- **THEN** payload MUST содержать запись `states` с `when: ["pressed", "selected"]`.

#### Scenario: Draft содержит ссылку на вложенный стиль

- **WHEN** draft property ссылается на стиль вложенного компонента
- **THEN** assembler MUST записать `styleRef` и добавить этот стиль и все стили, на которые он
  ссылается, в `styles`
- **AND** при цикле либо неизвестном стиле assembler MUST вернуть diagnostic
- **AND** MUST NOT формировать частичный payload.

### Requirement: Ассемблер передаёт контекст отрисовки web-компонента

Для платформы `WEB` ассемблер SHALL добавлять в payload то, без чего web-story нельзя отрисовать, только в
форматах схемы:
- в `theme` — цветовые токены выбранного режима, нужные окружению story (текст, фон, поверхности), все типографические токены текущего экрана с их шрифтами и токен шрифта тела;
- в `surface.background` — фон области превью ссылкой на токен темы или цветом;
- в `styles` — все стили всех вариаций и инварианты каждого компонента из зависимостей выбранного (с `variation`/`name`/`default`/`invariant`), вместе с токенами темы, на которые они ссылаются.

Ассемблер SHALL NOT передавать шаблоны многозначных свойств и web-корректировки: это знание
web-библиотеки, оно лежит в плагине. Ассемблер SHALL NOT выводить токены состояний по соглашению имён
(`-hover`, `-active`): в `states` попадают только состояния со значением.

#### Scenario: Подмена значения для web

- **WHEN** у стиля web-компонента для web-параметра свойства `color` задана подмена значения токеном `text.on-dark.primary`
- **THEN** в payload `WEB` свойство `color` MUST иметь источник `tokenRef` на `text.on-dark.primary`, а токен MUST попасть в `theme`

#### Scenario: ButtonGroup с кнопками

- **WHEN** открыт web `ButtonGroup`, у которого в зависимостях `Button`
- **THEN** `styles` MUST содержать все стили всех вариаций и инварианты `Button`, а `theme` — все токены, на которые они ссылаются

#### Scenario: Окружение story

- **WHEN** собирается payload для любого web-компонента
- **THEN** `theme` MUST содержать цветовые токены текста, фона и поверхностей выбранного режима и токен шрифта тела


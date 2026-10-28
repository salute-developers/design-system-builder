## MODIFIED Requirements

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

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Assembler формирует effective Compose properties

`ComposePreviewPayloadAssembler` SHALL формировать `payload.component.properties` из
invariants и properties всех выбранных styles, сохраняя канонические component property names.
Assembler MUST NOT интерпретировать Compose parameter names как ключи payload.

#### Scenario: Property с token reference

- **WHEN** selected или invariant property ссылается на theme token и доступна для Compose
- **THEN** её каноническое property name MUST получить `tokenRef` с исходным token ID.

#### Scenario: Property с literal и состояниями

- **WHEN** property содержит literal base и значения для состояний
- **THEN** assembler MUST нормализовать base и записать каждое значение состояния отдельной
  записью упорядоченного массива `states` вида `{when, source}`
- **AND** порядок записей MUST совпадать с порядком состояний в draft.

#### Scenario: Property содержит adjustment

- **WHEN** effective property использует поддержанный adjustment, который Preview Protocol v2
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

### Requirement: Assembled payload input соответствует Preview Protocol v2

Успешный результат assembler SHALL быть typed
`PreviewPayloadInput = Omit<PreviewPayload, "requestId">`. `ComposePreviewSession` SHALL добавить
уникальный `requestId`, после чего полный wire payload SHALL проходить canonical Preview
Protocol v2 JSON Schema.

#### Scenario: Полный Button payload собран

- **WHEN** Button draft содержит валидные component properties, theme references, example и
  surface
- **THEN** payload input MUST содержать protocol version 2, platform `COMPOSE`, component ID,
  variation context, effective properties, normalized theme, assets, example и surface
- **AND** после добавления session `requestId` wire payload MUST пройти canonical schema
  validation.

#### Scenario: Request correlation назначает host

- **WHEN** assembled payload input передаётся `ComposePreviewFrame`
- **THEN** `ComposePreviewSession` MUST назначить новый `requestId`
- **AND** session MUST сформировать полный typed `PreviewPayload`
- **AND** assembler MUST NOT управлять pending requests или iframe lifecycle.

## ADDED Requirements

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

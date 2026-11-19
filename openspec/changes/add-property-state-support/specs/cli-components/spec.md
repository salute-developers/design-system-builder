## ADDED Requirements

### Requirement: API meta normalization reads state support

Нормализатор каждой платформы SHALL выводить признак поддержки состояний свойства из существующих полей меты и знания
о генераторе этой платформы. Признак SHALL передаваться в манифест полем `stateSupport` каждого свойства:
`{ "states": [...], "combinations": <bool> }`. Признак выводится по всем вхождениям свойства, сведённым по
`(componentName, id)`. Список SHALL содержать только состояния, которые генератор платформы может выразить для этого
свойства. Имена канонизируются так же, как имена состояний компонента: kebab-case. Порядок — первое появление,
дубли исключены. Свойство, которое по правилам платформы состояний не принимает, SHALL уходить с пустым `states` и
`combinations: false`.

#### Scenario: Compose

- **WHEN** у вхождений параметра есть перегрузка `paramSimpleType` `StatefulValue`
- **THEN** `states` MUST содержать состояния взаимодействия генератора Compose (`focused`, `pressed`, `hovered`, `activated`, `selected`) и состояния компонента из `stateEnum`
- **WHEN** `StatefulValue` нет, но есть `InteractiveColor`
- **THEN** `states` MUST содержать только состояния взаимодействия генератора Compose
- **THEN** `states` MUST NOT содержать `disabled` и `readonly`: генератор Compose их не выражает
- **THEN** `combinations` MUST быть `true` в обоих случаях
- **WHEN** нет ни одной из этих перегрузок
- **THEN** `states` MUST быть пустым

#### Scenario: Android View

- **WHEN** тип свойства `color`, `dimension`, `float` или `typography`
- **THEN** `states` MUST содержать состояния framework (`focused`, `pressed`, `hovered`, `activated`, `checked`), `configName` из `stateSets` компонента и состояния из `stateValues` вхождений параметра
- **THEN** `combinations` MUST быть `true`
- **THEN** пустой `stateValues` MUST NOT делать список пустым
- **WHEN** тип свойства иной
- **THEN** `states` MUST быть пустым

#### Scenario: SwiftUI

- **WHEN** у вхождений параметра есть `paramSimpleType`, начинающийся со `Stateful` (например, `StatefulFillStyle`)
- **THEN** `states` MUST содержать состояния `InteractiveState` генератора iOS и состояния компонента из `stateEnum`, а `combinations` MUST быть `true`
- **WHEN** такого типа нет, но у вхождений задано поле `state`
- **THEN** `states` MUST содержать эти состояния, а `combinations` MUST быть `false`
- **WHEN** нет ни того, ни другого
- **THEN** `states` MUST быть пустым
- **WHEN** у `CheckBox.toggleIconColor` оба вхождения имеют тип `StatefulFillStyle` без поля `state`
- **THEN** `states` MUST NOT быть пустым

#### Scenario: Web

- **WHEN** у свойства есть токены с `state`
- **THEN** `states` MUST содержать ровно состояния этих токенов, а `combinations` MUST быть `false`: превью и генерация web выражают только одиночные состояния
- **WHEN** у `Button.backgroundColor` есть токены только для `pressed` и `hovered`
- **THEN** `states` MUST быть `pressed`, `hovered`
- **WHEN** токенов с `state` нет
- **THEN** `states` MUST быть пустым

#### Scenario: Признак уходит в запрос

- **WHEN** CLI формирует свойство тела `import-api-meta` командой `components import-api` или публикацией плагина превью
- **THEN** свойство MUST содержать `stateSupport` со списком `states` и флагом `combinations`
- **WHEN** нормализатор не вывел признак свойства
- **THEN** свойство MUST NOT содержать `stateSupport`; пустой список MUST отправляться только тогда, когда правило платформы явно говорит, что состояний нет

#### Scenario: Печать отчёта

- **WHEN** backend вернул ненулевой `stateSupportChanged` или непустой `unresolvedStates`
- **THEN** CLI MUST напечатать счётчик вместе со счётчиками `deprecated*`, а строки `unresolvedStates` — отдельным разделом
- **THEN** они MUST NOT влиять на код выхода, в том числе с `--strict`
- **WHEN** ответ прежней версии backend не содержит этих полей
- **THEN** CLI MUST считать счётчик равным нулю, а список пустым

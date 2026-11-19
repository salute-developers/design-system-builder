## ADDED Requirements

### Requirement: API meta normalization reads state support

Нормализатор каждой платформы SHALL выводить признак поддержки состояний свойства из существующих полей меты и SHALL
передавать его в манифест полем `stateSupport` каждого свойства. Признак выводится по всем вхождениям свойства,
сведённым по `(componentName, id)`. Состояние взаимодействия узнаётся по словарю общих состояний (`pressed`,
`hovered`, `focused`, `selected`, `activated`, `readonly`, `disabled`) без учёта регистра и знаков.

#### Scenario: Compose

- **WHEN** хотя бы одно вхождение параметра имеет `paramSimpleType` `StatefulValue`
- **THEN** признак MUST быть `any`
- **WHEN** перегрузки `StatefulValue` нет, но есть `InteractiveColor`
- **THEN** признак MUST быть `interaction`
- **WHEN** нет ни одной из этих перегрузок
- **THEN** признак MUST быть `none`

#### Scenario: Android View

- **WHEN** хотя бы одно вхождение параметра содержит непустой `stateValues`
- **THEN** признак MUST быть `any`, иначе `none`

#### Scenario: SwiftUI

- **WHEN** у вхождений параметра задано поле `state`
- **THEN** признак MUST быть `interaction`, если все такие состояния — состояния взаимодействия, иначе `any`
- **WHEN** ни у одного вхождения `state` не задан
- **THEN** признак MUST быть `none`

#### Scenario: Web

- **WHEN** у свойства есть токены с `state`
- **THEN** признак MUST быть `interaction`, если все такие состояния — состояния взаимодействия, иначе `any`
- **WHEN** токенов с `state` нет
- **THEN** признак MUST быть `none`

#### Scenario: Признак уходит в запрос

- **WHEN** CLI формирует свойство тела `import-api-meta`
- **THEN** свойство MUST содержать `stateSupport` со значением `none`, `interaction` или `any`

#### Scenario: Печать счётчика

- **WHEN** backend вернул `stateSupportChanged`, не равный нулю
- **THEN** CLI MUST напечатать его вместе со счётчиками `deprecated*`
- **THEN** ненулевой `stateSupportChanged` MUST NOT влиять на код выхода, в том числе с `--strict`
- **WHEN** ответ прежней версии backend не содержит `stateSupportChanged`
- **THEN** CLI MUST считать его равным нулю

## MODIFIED Requirements

### Requirement: Codec maps variation targets

Codec SHALL express native variation nesting as explicit targets in the common format, and SHALL
distinguish the key of a `view` entry from the axis value that entry denotes.

#### Scenario: Собственная ось значения берётся из последнего binding

- **WHEN** a native variation declares `binding` with entries `[{name: "size", value: "xl"}, {name: "shape", value: "pilled"}]`
- **THEN** the produced common configuration MUST contain a value named `pilled` inside the variation with `id = "shape"`

#### Scenario: Предшествующие binding становятся targets

- **WHEN** a native variation declares `binding` with entries `[{name: "size", value: "xl"}, {name: "shape", value: "pilled"}]`
- **THEN** the produced value MUST contain a target with property `id = "size"` and `value = "xl"`

#### Scenario: Значение без вложенности не имеет targets

- **WHEN** a native variation declares `binding` with a single entry
- **THEN** the produced common value MUST NOT contain targets

#### Scenario: Имя значения схемы берётся из binding записи

- **WHEN** a native configuration contains top-level `view` with key `state-accent` whose binding says `{name: "state", value: "accent"}`
- **THEN** the produced common configuration MUST contain a value named `accent` inside the colour scheme variation
- **THEN** codec MUST NOT produce a value named `state-accent`
- **THEN** that value MUST carry `state-accent` as its authored identifier

#### Scenario: Ключ записи используется, когда binding отсутствует

- **WHEN** a native `view` entry carries no `binding`
- **THEN** the produced common value MUST be named by the entry key

#### Scenario: Корневые view становятся значениями цветовой схемы

- **WHEN** a native configuration contains top-level `view` with key `accent` whose binding names the value `accent`
- **THEN** the produced common configuration MUST contain a value named `accent` inside the color scheme variation
- **THEN** that value MUST NOT contain targets

#### Scenario: View внутри вариации получает targets

- **WHEN** a native variation declares `view` with key `positive` whose binding names the value `positive`
- **THEN** the produced common configuration MUST contain a value named `positive` inside the color scheme variation
- **THEN** that value MUST contain targets derived from the variation `binding`

#### Scenario: Encode восстанавливает ключ записи из native идентификатора

- **WHEN** a common colour scheme value carries an authored identifier
- **THEN** codec MUST use that identifier as the `view` entry key
- **THEN** codec MUST write the value name into the entry `binding`
- **WHEN** the value carries no authored identifier
- **THEN** codec MUST use the value name as the entry key

### Requirement: Component config codec directions

Codec SHALL convert a single component configuration between the native format and the common format
in both directions, without assuming that an axis identifier equals an axis name.

#### Scenario: Decode преобразует native в common

- **WHEN** codec receives a valid native component configuration
- **THEN** codec MUST produce a common component configuration

#### Scenario: Encode преобразует common в native

- **WHEN** codec receives a valid common component configuration
- **THEN** codec MUST produce a native component configuration

#### Scenario: Encode различает идентификатор и имя оси

- **WHEN** a common configuration declares an axis whose `id` differs from its `name`
- **THEN** codec MUST use `name` as the axis name in the produced native configuration
- **THEN** codec MUST resolve `defaults[].id`, `targets[].properties[].id`, `rootVariationId` and `colorSchemeVariationId` through `id`
- **THEN** codec MUST NOT write an axis identifier into `bindings[].name` or into `binding[].name`

#### Scenario: Encode отклоняет ссылку на необъявленную ось

- **WHEN** a common configuration refers to an axis identifier that no declared axis carries
- **THEN** codec MUST return a deterministic failure naming the identifier
- **THEN** codec MUST NOT produce a native configuration

#### Scenario: Round trip common формата точен

- **WHEN** codec encodes a valid common configuration into native and decodes the result back
- **THEN** the produced common configuration MUST be equal to the input

#### Scenario: Round trip native формата сохраняет выразимое

- **WHEN** codec decodes a valid native configuration and encodes the result back
- **THEN** the produced native configuration MUST declare the same variation axes in the same order
- **THEN** it MUST declare the same default value for every axis
- **THEN** it MUST declare the same axis values in the same order, including values that no variation uses
- **THEN** it MUST declare the same `bindings[].type` for every axis
- **THEN** it MUST carry axis values of boolean axes as JSON booleans, not as strings
- **THEN** it MUST contain the same invariant properties with the same types and states
- **THEN** it MUST contain the same properties with the same types and states for every combination of axis values
- **THEN** it MUST reproduce every `view` entry under its original key
- **THEN** it MUST reproduce `variations[].parent` for every variation
- **THEN** codec MUST NOT be required to reproduce native fields that the common format does not carry, namely `variations[].id` when the value carries no authored identifier

#### Scenario: Codec не пишет в stdout

- **WHEN** codec performs any conversion
- **THEN** codec MUST NOT write diagnostic output to the process output streams
- **THEN** codec MUST report problems through its result type

### Requirement: Codec derives axis type

Codec SHALL carry the axis type declared by the configuration and derive it only when the
configuration declares none. The role of the colour scheme axis and its declared type are
independent facts: the role says where the values go, the type says how the axis is declared.

`sdds_serv` declares its colour scheme axis as `view` in all 46 cases, and the two look like one
fact there. `sdds_sbcom` declares 10 such axes as `enum` while keeping their values in `view` —
`counter` is one of them, and deriving the type from the role renamed its generated styles from
`Counter.Mute` to `Counter.MuteNo`.

#### Scenario: Объявленный тип воспроизводится как есть

- **WHEN** a configuration declares `bindings[].type` for an axis
- **THEN** codec MUST produce that same type when encoding the axis back
- **THEN** codec MUST NOT replace it with a type derived from the axis role

#### Scenario: Ось цветовой схемы, объявленная перечислением

- **WHEN** an axis carries the colour scheme role and is declared `enum`
- **THEN** codec MUST place its values in `view`
- **THEN** codec MUST produce `bindings[].type` equal to `enum`

#### Scenario: Необъявленная ось цветовой схемы получает тип view

- **WHEN** an axis carries the colour scheme role and the configuration declares no type for it
- **THEN** codec MUST produce `bindings[].type` equal to `view`

#### Scenario: Ось с булевыми значениями получает тип boolean

- **WHEN** an axis declares no type and its values are exactly `true` and `false`
- **THEN** codec MUST produce `bindings[].type` equal to `boolean`
- **THEN** codec MUST produce those values as JSON booleans

#### Scenario: Остальные оси получают тип enum

- **WHEN** an axis declares no type and is neither the colour scheme axis nor a boolean axis
- **THEN** codec MUST produce `bindings[].type` equal to `enum`

## ADDED Requirements

### Requirement: Codec derives variation parent from identifiers

Codec SHALL derive `variations[].parent` from the authored identifiers it already carries, taking the
longest proper dot-prefix that belongs to another variation of the same configuration. The parent
MUST NOT be carried as a separate stored field.

#### Scenario: Родитель — самый длинный известный префикс

- **WHEN** a configuration declares variations with identifiers `xs`, `xs.wide` and `xs.wide.default`
- **THEN** codec MUST produce `parent` equal to `xs.wide` for `xs.wide.default`
- **THEN** codec MUST produce `parent` equal to `xs` for `xs.wide`

#### Scenario: Идентификатор без префикса даёт корневую вариацию

- **WHEN** a variation identifier contains no dot
- **THEN** codec MUST produce `parent` as null

#### Scenario: Пропущенное звено не мешает

- **WHEN** a configuration declares `xs` and `xs.wide.default` but no `xs.wide`
- **THEN** codec MUST produce `parent` equal to `xs` for `xs.wide.default`

#### Scenario: Корневая вариация с несколькими осями

- **WHEN** a variation binds two axes and its identifier contains no dot
- **THEN** codec MUST produce `parent` as null
- **THEN** codec MUST NOT infer a parent from the axis coordinate

### Requirement: Corpus covers more than one design system

The corpus SHALL contain configurations from at least two design systems, because a single design
system can be degenerate in ways that hide defects.

`sdds_serv` proved degenerate on two counts at once: its colour scheme axis is always named `view`
(525 entries of 525), and the key of a `view` entry always equals the axis value (525 of 525). Both
coincidences were encoded as rules and both are false in `sdds_sbcom`, where the scheme axis carries
six different names and the key differs from the value in 67 cases of 70.

#### Scenario: Корпус охватывает вторую дизайн-систему

- **WHEN** the corpus is assembled
- **THEN** it MUST include configurations from at least two design systems
- **THEN** it MUST include a configuration whose colour scheme axis is not named `view`
- **THEN** it MUST include a configuration whose `view` entry key differs from its axis value

#### Scenario: Вырожденность корпуса не принимается за правило

- **WHEN** a rule is derived from the corpus
- **THEN** the rule MUST hold on every design system in the corpus, not only on one

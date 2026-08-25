## MODIFIED Requirements

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
- **THEN** codec MUST NOT be required to reproduce native fields that the common format does not carry, namely `variations[].id`, `variations[].parent` and the presence of `binding` inside a `view` entry

#### Scenario: Codec не пишет в stdout

- **WHEN** codec performs any conversion
- **THEN** codec MUST NOT write diagnostic output to the process output streams
- **THEN** codec MUST report problems through its result type

## ADDED Requirements

### Requirement: Codec carries declared axis values

Codec SHALL treat a declared axis value that carries no properties as part of the axis declaration,
because such a value is part of the component API even when it needs no overrides.

#### Scenario: Объявленное значение без свойств попадает в common

- **WHEN** a native configuration declares an axis value in `bindings[].values`
- **WHEN** no variation and no view entry uses that value
- **THEN** codec MUST produce a common axis value with that name
- **THEN** that value MUST carry no properties and no targets

#### Scenario: Объявленное значение без свойств возвращается в bindings

- **WHEN** a common axis value carries neither properties nor targets
- **THEN** codec MUST include its name in `bindings[].values` of the produced native configuration
- **THEN** codec MUST NOT produce a variation entry for it

#### Scenario: Ось без единого использованного значения сохраняется

- **WHEN** a native configuration declares an axis none of whose values is used by any variation
- **THEN** codec MUST produce a common axis carrying all its declared values
- **THEN** encoding the result back MUST declare the same axis with the same values

### Requirement: Codec derives axis type

Codec SHALL derive `bindings[].type` from the role and the value set of the axis, because the common
format does not carry the axis type.

#### Scenario: Ось цветовой схемы получает тип view

- **WHEN** the axis identifier equals `colorSchemeVariationId`
- **THEN** codec MUST produce `bindings[].type` equal to `view`

#### Scenario: Ось с булевыми значениями получает тип boolean

- **WHEN** the declared values of an axis are exactly `true` and `false`
- **THEN** codec MUST produce `bindings[].type` equal to `boolean`
- **THEN** codec MUST produce those values as JSON booleans

#### Scenario: Остальные оси получают тип enum

- **WHEN** an axis is neither the colour scheme axis nor a boolean axis
- **THEN** codec MUST produce `bindings[].type` equal to `enum`

### Requirement: Codec places property value by its type

Codec SHALL place a property value into the field the native format uses for its type.

#### Scenario: Цвет и градиент используют default

- **WHEN** a property value has type `color` or `gradient`
- **THEN** codec MUST write the value into field `default`
- **THEN** codec MUST NOT write it into field `value`

#### Scenario: Остальные типы используют value

- **WHEN** a property value has any other type
- **THEN** codec MUST write the value into field `value`
- **THEN** codec MUST NOT write it into field `default`

#### Scenario: Alpha и adjustment переносятся без изменений

- **WHEN** a property value carries `alpha` or `adjustment`
- **THEN** codec MUST carry them through both directions unchanged
- **THEN** codec MUST NOT normalize their textual form

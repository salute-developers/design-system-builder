## ADDED Requirements

### Requirement: Component config codec directions

Codec SHALL convert a single component configuration between the native format and the common format in both directions.

#### Scenario: Decode преобразует native в common

- **WHEN** codec receives a valid native component configuration
- **THEN** codec MUST produce a common component configuration

#### Scenario: Encode преобразует common в native

- **WHEN** codec receives a valid common component configuration
- **THEN** codec MUST produce a native component configuration

#### Scenario: Round trip common формата точен

- **WHEN** codec encodes a valid common configuration into native and decodes the result back
- **THEN** the produced common configuration MUST be equal to the input

#### Scenario: Round trip native формата сохраняет выразимое

- **WHEN** codec decodes a valid native configuration and encodes the result back
- **THEN** the produced native configuration MUST declare the same variation axes in the same order
- **THEN** it MUST declare the same default value for every axis
- **THEN** it MUST contain the same set of axis values that occur in variations and view entries, because `bindings[].values` may declare values that no variation uses
- **THEN** it MUST contain the same invariant properties with the same types and states
- **THEN** it MUST contain the same properties with the same types and states for every combination of axis values
- **THEN** codec MUST NOT be required to reproduce native fields that the common format does not carry, namely `variations[].id`, `variations[].parent`, `bindings[].type`, `bindings[].values` ordering, the presence of `binding` inside a `view` entry, and the JSON type of axis values on boolean axes
- **THEN** axis values MUST be compared by their textual content, because the common format names a value with a string

#### Scenario: Codec не пишет в stdout

- **WHEN** codec performs any conversion
- **THEN** codec MUST NOT write diagnostic output to the process output streams
- **THEN** codec MUST report problems through its result type

### Requirement: Native configuration contract

Codec SHALL accept native component configurations that declare their variation axes explicitly.

#### Scenario: Native конфигурация содержит поддерживаемые поля

- **WHEN** codec parses a native configuration
- **THEN** codec MUST support top-level object field `props`
- **THEN** codec MUST support top-level object field `view`
- **THEN** codec MUST support top-level array field `bindings` with entries containing `name`, `type`, `values`, and `defaultValue`
- **THEN** codec MUST support top-level array field `variations`
- **THEN** each variation MUST support fields `id`, `parent`, `binding`, `props`, and `view`
- **THEN** each variation MUST support optional field `key`

#### Scenario: Bindings обязателен при наличии вариаций

- **WHEN** a native configuration contains a non-empty `variations` array
- **WHEN** that configuration does not contain `bindings`
- **THEN** codec MUST return a deterministic failure result
- **THEN** codec MUST NOT infer variation axes from variation identifiers

#### Scenario: Конфигурация без вариаций валидна без bindings

- **WHEN** a native configuration contains an empty `variations` array
- **WHEN** that configuration does not contain `bindings`
- **THEN** codec MUST accept the configuration
- **THEN** the produced common configuration MUST contain the invariant properties
- **THEN** the produced common configuration MUST contain no variations

#### Scenario: Вариация без binding отклоняется

- **WHEN** a native configuration contains a variation without field `binding`
- **THEN** codec MUST return a deterministic failure result naming that variation `id`

#### Scenario: Расхождение key и binding отклоняется

- **WHEN** a variation declares field `key`
- **WHEN** `key` differs from the `name` of the last entry in that variation `binding`
- **THEN** codec MUST return a deterministic failure result naming that variation `id`

### Requirement: Codec reads variation axes from bindings

Codec SHALL derive the common configuration axis metadata from the native `bindings` block instead of parsing variation identifiers.

#### Scenario: Ось вариации берётся из bindings

- **WHEN** native `bindings` contains an entry with `name = "size"`
- **THEN** the produced common configuration MUST contain a variation with `id = "size"` and `name = "size"`

#### Scenario: Цветовая схема определяется типом binding

- **WHEN** native `bindings` contains an entry with `type = "view"`
- **THEN** the produced common configuration `colorSchemeVariationId` MUST equal the `name` of that entry

#### Scenario: Корневая ось берётся из bindings

- **WHEN** native `bindings` declares the axes of the configuration
- **THEN** the produced common configuration `rootVariationId` MUST equal the `name` of the first declared axis
- **THEN** codec MUST NOT use a hardcoded axis name

#### Scenario: Дефолты вариаций переносятся

- **WHEN** native `bindings` contains an entry with `name = "size"` and `defaultValue = "xl"`
- **THEN** the produced common configuration `defaults` MUST contain an entry with `id = "size"` and `value = "xl"`

### Requirement: Codec maps variation targets

Codec SHALL express native variation nesting as explicit targets in the common format.

#### Scenario: Собственная ось значения берётся из последнего binding

- **WHEN** a native variation declares `binding` with entries `[{name: "size", value: "xl"}, {name: "shape", value: "pilled"}]`
- **THEN** the produced common configuration MUST contain a value named `pilled` inside the variation with `id = "shape"`

#### Scenario: Предшествующие binding становятся targets

- **WHEN** a native variation declares `binding` with entries `[{name: "size", value: "xl"}, {name: "shape", value: "pilled"}]`
- **THEN** the produced value MUST contain a target with property `id = "size"` and `value = "xl"`

#### Scenario: Значение без вложенности не имеет targets

- **WHEN** a native variation declares `binding` with a single entry
- **THEN** the produced common value MUST NOT contain targets

#### Scenario: Корневые view становятся значениями цветовой схемы

- **WHEN** a native configuration contains top-level `view` with key `accent`
- **THEN** the produced common configuration MUST contain a value named `accent` inside the color scheme variation
- **THEN** that value MUST NOT contain targets

#### Scenario: View внутри вариации получает targets

- **WHEN** a native variation declares `view` with key `positive`
- **THEN** the produced common configuration MUST contain a value named `positive` inside the color scheme variation
- **THEN** that value MUST contain targets derived from the variation `binding`

### Requirement: Common configuration contract

Codec SHALL produce and accept common component configurations that match the DS Builder common configuration schema.

#### Scenario: Common конфигурация содержит поддерживаемые поля

- **WHEN** codec produces a common configuration
- **THEN** it MUST contain string field `rootVariationId`
- **THEN** it MUST contain string field `colorSchemeVariationId`
- **THEN** it MUST contain object field `invariants`
- **THEN** it MUST contain array field `defaults` with entries containing `id` and `value`
- **THEN** it MUST contain array field `variations` with entries containing `id`, `name`, and `values`
- **THEN** each value MUST contain field `name`, optional field `targets`, and object field `properties`

#### Scenario: Инварианты переносятся без изменения

- **WHEN** a native configuration contains top-level `props`
- **THEN** the produced common configuration `invariants` MUST contain the same property entries

#### Scenario: Свойства значения используют ключ properties

- **WHEN** codec produces a value of a common variation
- **THEN** the property map MUST be serialized under key `properties`
- **THEN** codec MUST NOT serialize it under key `props`

### Requirement: Codec is verified against real configuration corpus

Codec SHALL be verified against the actual component configurations published in the `theme-converter` repository.

#### Scenario: Round trip покрывает корпус конфигураций

- **WHEN** codec tests run
- **THEN** tests MUST decode and re-encode a stored corpus of native configurations taken from live design systems
- **THEN** every corpus entry MUST round trip without failure
- **THEN** every corpus entry MUST preserve the axes, defaults, axis values, and properties that the common format carries

#### Scenario: Корпус включает конфигурацию без вариаций

- **WHEN** codec tests run
- **THEN** the corpus MUST include at least one configuration with an empty `variations` array and no `bindings`

#### Scenario: Корпус включает вложенные вариации

- **WHEN** codec tests run
- **THEN** the corpus MUST include at least one configuration with variations whose `binding` contains more than one entry

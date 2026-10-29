## MODIFIED Requirements

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
- **THEN** the produced common configuration `rootVariationId` MUST equal the `name` of the axis named `size` when the configuration declares it
- **THEN** otherwise `rootVariationId` MUST equal the `name` of the first declared axis other than the colour scheme axis
- **THEN** codec MUST NOT use an axis name other than `size` to choose the root

#### Scenario: Корень не уходит на ось цветовой схемы

- **WHEN** the first declared axis is the colour scheme axis and another axis is declared
- **THEN** `rootVariationId` MUST equal the `name` of the first axis that is not the colour scheme axis

#### Scenario: Единственная ось — цветовая схема

- **WHEN** the only declared axis is the colour scheme axis
- **THEN** the produced common configuration MUST carry `rootVariationId` as absent

#### Scenario: Дефолты вариаций переносятся

- **WHEN** native `bindings` contains an entry with `name = "size"` and `defaultValue = "xl"`
- **THEN** the produced common configuration `defaults` MUST contain an entry with `id = "size"` and `value = "xl"`

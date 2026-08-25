# component-appearance-model Specification

## Purpose
TBD - created by archiving change add-cli-components-fetch. Update Purpose after archive.
## Requirements
### Requirement: Variation axis declaration belongs to the appearance

`db-service` SHALL store the declaration of variation axes — which axes a component style exposes,
in which order, with which declared values and which default — as a fact of the appearance, not
of the component and not of the design system.

#### Scenario: Порядок осей принадлежит стилю

- **WHEN** two appearances of the same component declare the same axes in different order
- **THEN** each appearance MUST keep its own order
- **THEN** the order MUST be expressed by an explicit position, not by row order of a query

#### Scenario: Состав осей принадлежит стилю

- **WHEN** one appearance of a component declares axes `(size)` and another declares `(size, view)`
- **THEN** the first appearance MUST NOT expose the axis `view`
- **THEN** the axes of an appearance MUST come from its declaration, not from which styles exist in the design system

#### Scenario: Дефолт оси принадлежит стилю

- **WHEN** two appearances of the same component declare a different default value for the same axis
- **THEN** both defaults MUST be stored
- **THEN** writing the default of one appearance MUST NOT change the default of another
- **THEN** the design-system-wide default flag on a style MUST NOT exist

#### Scenario: Ось может не иметь дефолта

- **WHEN** an axis declaration carries no default value
- **THEN** the declaration MUST remain valid with an empty default
- **THEN** removing the style that was the default MUST leave the declaration in place

### Requirement: Declared axis values are stored, not derived

`db-service` SHALL store every declared value of an axis, including values for which the appearance
carries no property override.

#### Scenario: Значение без переопределений сохраняется

- **WHEN** an appearance declares axis `shape` with values `default` and `pilled`
- **WHEN** only `pilled` carries property overrides
- **THEN** both values MUST be stored as declared values of that axis
- **THEN** reading the declaration back MUST yield both values

#### Scenario: Ось без единого использованного значения сохраняется

- **WHEN** an appearance declares an axis whose values carry no property overrides at all
- **THEN** the axis MUST be stored with its declared values
- **THEN** the axis MUST be present when the appearance is read back

#### Scenario: Порядок значений оси сохраняется

- **WHEN** declared values of an axis are stored
- **THEN** their order MUST be expressed by an explicit position
- **THEN** reading them back MUST yield the same order

### Requirement: Property value completeness

`db-service` SHALL store every field a property value carries in a component configuration, so that
the value can be returned in the form it was received.

#### Scenario: Alpha сохраняется

- **WHEN** a property value carries `alpha`
- **THEN** the stored value MUST keep it
- **THEN** reading the value back MUST return the same `alpha`

#### Scenario: Adjustment сохраняется

- **WHEN** a property value of type `shape` carries `adjustment`
- **THEN** the stored value MUST keep it
- **THEN** reading the value back MUST return the same `adjustment`

#### Scenario: Значение состояния несёт свои поля

- **WHEN** a property value carries a state override with its own `alpha`
- **THEN** that `alpha` MUST be stored on the row that carries the state set
- **THEN** it MUST NOT be merged with the base value

#### Scenario: Состояние со своим типом разрешает свой токен

- **WHEN** a state override declares a type that differs from the type of the base value
- **THEN** the token reference of that override MUST be resolved by the type of the override
- **THEN** it MUST NOT be resolved by the type of the base value
- **THEN** an override whose type refers to a token MUST NOT lose the reference because the base
  value is of a type that carries no token

#### Scenario: Значение сохраняется в исходной записи

- **WHEN** `alpha` or `adjustment` is stored
- **THEN** it MUST be kept in the textual form in which it was received
- **THEN** it MUST NOT be normalized to a numeric representation

### Requirement: Property type describes the API slot

`db-service` SHALL treat `properties.type` as the type of the component API slot, imported from
component code. A paint slot SHALL be stored as `color`, which denotes the family of values that
covers both a solid colour and a gradient. `gradient` SHALL NOT be stored as the type of a paint
slot: it discriminates a value, not a slot.

#### Scenario: Словарь типов слота — словарь типов API

- **WHEN** the set of types a property may be stored with is defined
- **THEN** it MUST be the vocabulary declared by component code
- **THEN** it MUST NOT contain `gradient`
- **THEN** the set of types a configuration value may declare MUST be defined separately, and MUST contain `gradient`

#### Scenario: Слот не зависит от дизайн-системы

- **WHEN** two design systems give the same component property values of different types
- **THEN** the type stored on the property MUST stay the same for both
- **THEN** the property row MUST remain one row shared by both design systems

#### Scenario: Импорт конфигурации не переписывает слот

- **WHEN** a component configuration is imported
- **THEN** the import MUST NOT write the type stored on the property
- **THEN** importing a configuration whose values are all gradients MUST leave a `color` slot as `color`

#### Scenario: Повторная заливка другой дизайн-системы не меняет слот

- **WHEN** a design system is imported after another design system that used the same property
- **THEN** the type stored on the property MUST be the one imported from component code
- **THEN** it MUST NOT depend on the order in which design systems were imported

### Requirement: Value type is derived per value

`db-service` SHALL NOT store the type of a property value. The type SHALL be derived separately for
every stored value — an invariant value, a variation value, a cross-axis combination and a state
override alike — from the token that value refers to, falling back to the type of the property.

#### Scenario: Тип значения выводится из токена

- **WHEN** a property value refers to a token
- **WHEN** the token type is `gradient`
- **THEN** the value MUST be reported with type `gradient`
- **THEN** the type stored on the property MUST remain unchanged

#### Scenario: Одно свойство несёт оба типа в разных вариациях

- **WHEN** a property refers to a colour token under one axis value and to a gradient token under another
- **THEN** each value MUST be reported with the type derived from its own token
- **THEN** the two values MUST NOT be reduced to one type

#### Scenario: Переопределение состояния выводит свой тип

- **WHEN** the base value of a property refers to a colour token
- **WHEN** its state override refers to a gradient token
- **THEN** the override MUST be reported with type `gradient`
- **THEN** the base value MUST be reported with type `color`

#### Scenario: Кросс-осевое сочетание выводит свой тип

- **WHEN** a value stored as a cross-axis combination refers to a gradient token
- **THEN** the combination MUST keep a reference to that token
- **THEN** the value MUST be reported with type `gradient`
- **THEN** the type MUST NOT be derived from the token name held as text

#### Scenario: Значение без разрешённого токена берёт тип свойства

- **WHEN** a property value refers to a token name that does not exist in the design system
- **THEN** the value MUST be reported with the type stored on the property
- **THEN** the value itself MUST still be reported

#### Scenario: Невыведенный тип предъявляется, а не умалчивается

- **WHEN** an export reports values whose type could not be derived because their token reference
  is unresolved
- **THEN** the response MUST list those values
- **THEN** the response MUST NOT present the fallback type as a derived one
- **THEN** the export MUST NOT be rejected because of them

#### Scenario: Литеральное значение берёт тип свойства

- **WHEN** a property value carries a literal rather than a token reference
- **THEN** the value MUST be reported with the type stored on the property
- **THEN** it MUST NOT be listed as a value whose type could not be derived

#### Scenario: Один тип свойства покрывает цвет и градиент

- **WHEN** a property is declared with type `color` by component code
- **WHEN** its values refer to both colour and gradient tokens
- **THEN** the property type MUST remain `color`
- **THEN** the import MUST NOT report this as a type mismatch

#### Scenario: Paint-слот без единого сплошного цвета сообщается отдельно

- **WHEN** an imported package gives a property with a paint slot only gradient values, never a colour one
- **THEN** the import MUST report that property separately from type mismatches
- **THEN** the report MUST NOT reject the configuration
- **THEN** the report MUST be computed over the whole imported package, not over a single configuration
- **WHEN** one configuration of the package gives the property only gradients while another gives it a colour
- **THEN** the property MUST NOT appear in that report

#### Scenario: Имя токена однозначно определяет вид

- **WHEN** the type of a value is derived from its token
- **THEN** the derivation MUST rely on token identity within the design system
- **THEN** a token name MUST NOT be able to denote both a colour and a gradient in one design system

### Requirement: Component name belongs to the component code

`db-service` SHALL treat the stored component name as the name used by component code, imported
from `uikit-api-meta.json`. Appearance configurations SHALL NOT rewrite it.

#### Scenario: Имя пишет только импорт метаинформации кода

- **WHEN** the global layer of components is populated
- **THEN** the component name MUST be the name declared by `uikit-api-meta.json`
- **THEN** seeds MUST use the same spelling as `uikit-api-meta.json`
- **THEN** importing a component configuration MUST NOT create or rename a component

#### Scenario: Имя конфигурации выводится обратимо

- **WHEN** the component name is reported for a component package
- **THEN** it MUST be derived from the stored name by lowering camel-case boundaries to hyphens
- **THEN** the derivation MUST be verified by converting the result back and comparing it with the stored name

#### Scenario: Необратимое имя отклоняется

- **WHEN** converting the derived name back does not reproduce the stored name
- **THEN** the request MUST be rejected with a deterministic error naming the component
- **THEN** a name that cannot be derived MUST NOT be reported

### Requirement: Component configuration export

`db-service` SHALL provide an endpoint that returns every component configuration of a design system
in one response, mirroring the import endpoint.

#### Scenario: Export адресует дизайн-систему телом запроса

- **WHEN** a client requests an export
- **THEN** the design system MUST be addressed by `designSystemId` in the request body
- **THEN** the request path MUST NOT contain the design system identifier or its name
- **THEN** the response MUST contain every component configuration of that design system

#### Scenario: Export требует read scope

- **WHEN** the request carries project scopes
- **WHEN** the scopes do not include `components:read`
- **THEN** the endpoint MUST reject the request
- **THEN** the rejection MUST happen before the configurations are assembled

#### Scenario: Export отдаёт common формат именами

- **WHEN** the response carries a component configuration
- **THEN** axes MUST be identified by their name, not by a database identifier
- **THEN** `rootVariationId`, `colorSchemeVariationId`, `defaults[].id` and `targets[].properties[].id` MUST all use axis names

#### Scenario: Export детерминирован

- **WHEN** the same design system is exported twice without intervening changes
- **THEN** both responses MUST list components in the same order
- **THEN** both responses MUST list axes, axis values and properties in the same order

#### Scenario: Правило типа общее для всех читающих ручек

- **WHEN** any endpoint of `db-service` returns a component configuration
- **THEN** it MUST report the type derived for each value
- **THEN** two endpoints MUST NOT report different types for the same stored value

#### Scenario: Export пишет фактический тип значения

- **WHEN** an export serialises a property value
- **THEN** the `type` field MUST carry the type derived for that value
- **THEN** it MUST NOT carry the type stored on the property when the two differ
- **THEN** a value of type `color` or `gradient` MUST be placed in `default`
- **THEN** a value of any other type MUST be placed in `value`

#### Scenario: Export пишет тип состояния только при расхождении

- **WHEN** an export serialises a state override whose derived type differs from the derived type of the base value
- **THEN** the override MUST carry its own type
- **WHEN** the two derived types are the same
- **THEN** the override MUST NOT carry a type

#### Scenario: Export отклоняет дизайн-систему без версии

- **WHEN** the design system has no published version
- **THEN** the endpoint MUST reject the request with a deterministic error
- **THEN** it MUST NOT substitute a placeholder version


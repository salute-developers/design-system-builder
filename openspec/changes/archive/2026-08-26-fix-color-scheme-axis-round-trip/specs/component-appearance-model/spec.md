## ADDED Requirements

### Requirement: Colour scheme axis role is stored, not derived

`db-service` SHALL store which axis of an appearance plays the colour scheme role, because the role is
declared by the configuration and cannot be recovered from the axis name. Deriving it from the name
`view` holds only for design systems that happen to use that name.

#### Scenario: Роль оси сохраняется при заливке

- **WHEN** an import receives a configuration carrying `colorSchemeVariationId`
- **THEN** the named axis MUST be stored as the colour scheme axis of that appearance
- **THEN** reading the appearance back MUST report the same axis as the colour scheme axis

#### Scenario: Выгрузка опирается на сохранённую роль

- **WHEN** an export assembles a component configuration
- **THEN** `colorSchemeVariationId` MUST name the axis stored as the colour scheme axis
- **THEN** the export MUST NOT identify the colour scheme axis by its name

#### Scenario: Ось схемы под любым именем возвращается блоком view

- **WHEN** an appearance stores a colour scheme axis named `state`
- **THEN** the exported configuration MUST place the values of that axis in `view`
- **THEN** it MUST NOT place them among the ordinary variations

#### Scenario: Appearance без оси схемы

- **WHEN** an appearance stores no colour scheme axis
- **THEN** the exported configuration MUST carry `colorSchemeVariationId` as absent
- **THEN** every axis MUST be exported as an ordinary variation

### Requirement: View entry key is stored apart from the axis value

`db-service` SHALL treat the key of a `view` entry as an authored label of that entry and the value named
by the entry's own `binding` as the axis value. The two coincide in some design systems and differ in
others, so the key MUST NOT be used to identify the axis value.

#### Scenario: Значение оси берётся из binding записи

- **WHEN** an import receives a `view` entry with key `state-accent` whose binding says `{name: state, value: accent}`
- **THEN** the entry MUST be attached to the axis value `accent`
- **THEN** no axis value named `state-accent` MUST be created

#### Scenario: Ключ записи сохраняется как подпись

- **WHEN** a `view` entry carries a key that differs from its axis value
- **THEN** the key MUST be stored as the authored identifier of that axis value
- **THEN** an export MUST reproduce the entry under the stored key

#### Scenario: Ключ отсутствует у значения, не пришедшего из конфигурации

- **WHEN** an axis value carries no stored authored identifier
- **THEN** an export MUST use the axis value name as the `view` entry key

#### Scenario: Запись view без binding

- **WHEN** a `view` entry carries no `binding`
- **THEN** the entry MUST be attached to the axis value named by its key
- **THEN** the import MUST NOT invent an axis value that the declaration does not carry

### Requirement: Variation parent is derived, not stored

`db-service` SHALL NOT store the parent of an axis value. The parent is recoverable from the stored
authored identifiers, and storing it duplicates a fact the model already holds.

#### Scenario: Родитель не хранится

- **WHEN** an import records an axis value carrying an authored identifier
- **THEN** it MUST NOT store a separate parent for that value

#### Scenario: Выгрузка не отдаёт родителя

- **WHEN** an export serialises an axis value
- **THEN** the value MUST carry its authored identifier when one is stored
- **THEN** the value MUST NOT carry a parent

### Requirement: Stored identifiers are named by their origin

The model SHALL name the stored variation identifier after its origin rather than after a platform
or a serialisation format. The stored fact is an identifier written by the author of the
configuration that the model cannot compute.

#### Scenario: Модель не несёт признака платформы

- **WHEN** an axis value stores the identifier written in the source configuration
- **THEN** the field MUST be named `authored_id` in persistence and `authoredId` in the common format
- **THEN** neither name MUST refer to a platform or to a serialisation format

### Requirement: Import reports identifiers it cannot derive

`db-service` SHALL report configurations whose variation identifiers do not follow from the values of
their axes, so that the need to store them stays measurable instead of silent.

#### Scenario: Невыводимый идентификатор попадает в отчёт

- **WHEN** an import receives a variation whose identifier differs from the identifier that its axis values would produce
- **THEN** the import report MUST name that configuration
- **THEN** the import MUST NOT reject the configuration

#### Scenario: Выводимый идентификатор молчит

- **WHEN** every variation identifier of a configuration follows from its axis values
- **THEN** the import report MUST NOT mention that configuration

### Requirement: Declared axis type is stored beside the role

`db-service` SHALL store the axis type declared by the configuration separately from the colour
scheme role, because the two are independent: the role says where the values of the axis go, the
declared type says how the axis is announced in `bindings`.

#### Scenario: Тип объявления сохраняется

- **WHEN** an import receives an axis whose configuration declares a type
- **THEN** that type MUST be stored on the axis declaration
- **THEN** an export MUST return it unchanged

#### Scenario: Ось схемы, объявленная перечислением

- **WHEN** an axis carries the colour scheme role and is declared `enum`
- **THEN** both facts MUST be stored
- **THEN** an export MUST report the role and the declared type separately

#### Scenario: Тип не объявлен

- **WHEN** a configuration declares no type for an axis
- **THEN** the stored declared type MUST be absent
- **THEN** the type MUST be derived when the configuration is assembled back

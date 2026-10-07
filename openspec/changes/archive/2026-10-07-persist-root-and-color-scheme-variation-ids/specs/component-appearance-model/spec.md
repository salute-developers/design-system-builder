## MODIFIED Requirements

### Requirement: Colour scheme axis role is stored, not derived

The service SHALL store which axis of an appearance plays the colour scheme role as a reference from the
appearance to one of its declared axes, because the role is declared by the configuration and cannot be
recovered from the axis name. Deriving it from the name `view` holds only for design systems that happen to
use that name. An appearance SHALL have at most one colour scheme axis, and that axis SHALL be declared at
the same appearance.

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

#### Scenario: Роль принадлежит оси этого appearance

- **WHEN** a colour scheme role is assigned to an axis
- **THEN** that axis MUST be declared at the same appearance
- **THEN** an axis declared only at another appearance MUST be rejected

#### Scenario: Назначение роли другой оси переносит её

- **WHEN** a colour scheme role is assigned to an axis while another axis of the appearance holds it
- **THEN** the previous axis MUST lose the role
- **THEN** the appearance MUST report exactly one colour scheme axis

#### Scenario: Удаление оси снимает роль

- **WHEN** the axis holding the colour scheme role is removed from the appearance
- **THEN** the appearance MUST report no colour scheme axis

## ADDED Requirements

### Requirement: Root axis role is stored

The service SHALL store which axis of an appearance is the root axis as a reference from the appearance to
one of its declared axes. An appearance SHALL have at most one root axis, and that axis SHALL be declared at
the same appearance. The export MUST NOT identify the root axis by its name.

#### Scenario: Корень сохраняется при заливке

- **WHEN** an import receives a configuration carrying `rootVariationId`
- **THEN** the named axis MUST be stored as the root axis of that appearance
- **THEN** reading the appearance back MUST report the same axis as the root axis

#### Scenario: Корень под любым именем возвращается выгрузкой

- **WHEN** an appearance stores a root axis named `shape` and also declares an axis named `size`
- **THEN** the exported configuration MUST carry `rootVariationId` naming `shape`

#### Scenario: Указанный корень отсутствует среди осей

- **WHEN** an import receives a `rootVariationId` that names no axis of the configuration
- **THEN** the import MUST be rejected
- **THEN** the import MUST NOT substitute another axis as the root

#### Scenario: Роль принадлежит оси этого appearance

- **WHEN** the root role is assigned to an axis
- **THEN** that axis MUST be declared at the same appearance
- **THEN** an axis declared only at another appearance MUST be rejected

#### Scenario: Назначение корня другой оси переносит роль

- **WHEN** the root role is assigned to an axis while another axis of the appearance holds it
- **THEN** the previous axis MUST lose the role
- **THEN** the appearance MUST report exactly one root axis

#### Scenario: Одна ось не бывает корнем и осью схемы через ручки осей

- **WHEN** a request assigns the root role to the colour scheme axis, or the colour scheme role to the root axis
- **THEN** the request MUST be rejected as a conflict
- **THEN** the stored roles MUST remain unchanged

### Requirement: Absent root falls back to a derived axis

The service SHALL choose the root axis by a fixed fallback order and store it, when a configuration does not
carry `rootVariationId` or the root role is released by removing its axis. The candidates are the axes other
than the colour scheme axis; the order is: the axis named `size`; otherwise the first candidate by position;
otherwise none.

#### Scenario: Корня нет в конфиге, есть ось size

- **WHEN** an import receives a configuration without `rootVariationId` that declares an axis named `size`
- **THEN** that axis MUST be stored as the root axis

#### Scenario: Корня нет в конфиге и нет оси size

- **WHEN** an import receives a configuration without `rootVariationId` that declares axes `shape` and `view`, with `view` as the colour scheme axis
- **THEN** `shape` MUST be stored as the root axis

#### Scenario: Ось схемы не становится корнем по фолбэку

- **WHEN** the only declared axis is the colour scheme axis and the configuration carries no `rootVariationId`
- **THEN** the appearance MUST store no root axis

#### Scenario: Первая ось, созданная ручкой осей, становится корнем

- **WHEN** an axis is created through the axis endpoint for an appearance that has no root axis
- **THEN** the axis MUST become the root unless it is the colour scheme axis

#### Scenario: Снятая с оси роль корня не возвращается ей по фолбэку

- **WHEN** the root role is released from an axis by a request and other candidate axes exist
- **THEN** the root MUST be chosen again by the fallback order among the other axes
- **THEN** the released axis MUST NOT be chosen again

#### Scenario: Appearance без осей

- **WHEN** an appearance declares no axes
- **THEN** the exported configuration MUST carry `rootVariationId` as absent

#### Scenario: Удаление корневой оси пересчитывает корень

- **WHEN** the root axis is removed from an appearance that declares other axes
- **THEN** the root MUST be chosen again by the fallback order
- **THEN** the removed axis MUST NOT remain referenced

### Requirement: Axis roles are available through axis endpoints

The endpoints that create, update and return appearance axes SHALL carry both roles. `isColorScheme` and
`isRoot` of an axis SHALL be true exactly for the axis the appearance references for that role, and SHALL NOT
be stored independently of that reference.

#### Scenario: Ответ несёт обе роли

- **WHEN** an endpoint returns an appearance axis
- **THEN** the response MUST contain `isColorScheme` and `isRoot`
- **THEN** each MUST agree with the references stored on the appearance

#### Scenario: Запрос на создание оси назначает роль

- **WHEN** a request creates an axis with `isRoot` set to true
- **THEN** the appearance MUST reference that axis as its root

#### Scenario: Снятие роли с оси без роли

- **WHEN** a request sets `isRoot` to false on an axis that is not the root
- **THEN** the stored roles MUST remain unchanged

#### Scenario: Снятие роли цветовой схемы

- **WHEN** a request sets `isColorScheme` to false on the colour scheme axis
- **THEN** the appearance MUST report no colour scheme axis

### Requirement: Stored roles are migrated from the previous model

Existing appearances SHALL receive the new references from the data already stored: the colour scheme axis
from the axis flagged as colour scheme, and the root axis by the fallback order. The previous colour scheme
flag SHALL remain equal to the new reference for as long as `db-service` is kept as an HTTP rollback.

#### Scenario: Роль схемы переносится из флага

- **WHEN** the migration runs on an appearance with a flagged colour scheme axis
- **THEN** the appearance MUST reference that axis as its colour scheme axis

#### Scenario: Корень проставляется существующим appearance

- **WHEN** the migration runs on an appearance with axes and no stored root
- **THEN** the root MUST be set by the fallback order, after the colour scheme axis is transferred

#### Scenario: Флаг остаётся синхронным

- **WHEN** the colour scheme role changes through any endpoint
- **THEN** the previous colour scheme flag MUST be updated in the same transaction
- **THEN** the flag MUST be true only on the axis the appearance references

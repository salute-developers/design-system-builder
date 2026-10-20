## MODIFIED Requirements

### Requirement: State vocabulary is a table

`ds-service` SHALL store the whole state vocabulary in a single table `states`, covering both
interaction states and states declared by component code. The enum type `state` SHALL NOT exist.

#### Scenario: Состояние взаимодействия не принадлежит компоненту

- **WHEN** a state is one of `pressed`, `hovered`, `focused`, `selected`, `activated`, `readonly`, `disabled`
- **THEN** its row MUST have `component_id` set to `NULL`
- **THEN** its `name` MUST be unique among rows with `component_id IS NULL`

#### Scenario: Состояние компонента принадлежит компоненту

- **WHEN** a state is declared by component code through `uikit-compose-api-meta.json` field `stateEnum`
- **THEN** its row MUST reference the owning component through `component_id`
- **THEN** the pair (`component_id`, `name`) MUST be unique
- **THEN** `name` MUST be stored in the form used by appearance configurations, for example `dragging-over`

#### Scenario: Одноимённые состояния разных компонентов различимы

- **WHEN** two different components declare a state with the same `name`
- **THEN** `states` MUST contain two rows with different identifiers
- **THEN** any set built from them MUST be distinguishable by identifier

### Requirement: State set is a first-class entity

`ds-service` SHALL store a set of states as a row in `state_sets` holding a canonicalized array of
state identifiers. Two sets with the same members SHALL be the same row.

#### Scenario: Массив канонизируется при записи

- **WHEN** a `state_sets` row is inserted or updated
- **THEN** `state_ids` MUST be stored sorted and deduplicated
- **THEN** an input array in any order MUST produce the same stored array

#### Scenario: Одинаковые наборы не дублируются

- **WHEN** a set with the same members already exists
- **THEN** insertion of a second row MUST be rejected by a unique index on `state_ids`

#### Scenario: Пустой набор представлен строкой

- **WHEN** a property value applies outside of any state
- **THEN** it MUST reference the sentinel row whose `state_ids` is the empty array
- **THEN** `state_set_id` MUST NOT be nullable in any referencing table

#### Scenario: Сентинел защищён от удаления

- **WHEN** deletion of the sentinel row is attempted
- **THEN** a `BEFORE DELETE` trigger MUST reject it, because every base value references that single row
- **THEN** `TRUNCATE state_sets` MUST be rejected by a statement-level `ON TRUNCATE` trigger
- **THEN** the deletion policy for states MUST NOT reach the sentinel, since an empty array contains no state

### Requirement: Deleting a state deletes dependent values

`ds-service` SHALL delete every property value whose state set contains the deleted state, together
with the sets themselves. Sets SHALL NOT be silently shrunk.

#### Scenario: Значения с удаляемым состоянием удаляются

- **WHEN** a state is deleted
- **THEN** every `state_sets` row whose `state_ids` contains it MUST be deleted
- **THEN** every property value referencing those sets MUST be deleted by the `ON DELETE CASCADE` on `state_set_id`
- **THEN** values referencing sets without that state MUST remain unchanged
- **THEN** base values, which reference the sentinel set, MUST remain unchanged

#### Scenario: Набор не сжимается

- **WHEN** a deleted state is one member of a set with two or more members
- **THEN** the set MUST be deleted whole
- **THEN** the remaining members MUST NOT produce a shrunk set
- **THEN** values referencing that set MUST NOT be repointed to another set

#### Scenario: Каскад вниз объявлен

- **WHEN** property values are deleted because of state deletion
- **THEN** dependent rows in `variation_platform_param_adjustments`, `invariant_platform_param_adjustments` and `component_style_references` MUST be deleted by cascade
- **THEN** the base value on the same coordinates MUST remain, so the component falls back to it

### Requirement: Array integrity is enforced by triggers

Because a `uuid[]` column cannot carry foreign keys, `ds-service` SHALL enforce the integrity of
`state_sets.state_ids` with three triggers. Their absence SHALL be treated as a defect, not as an
optimisation.

#### Scenario: Элементы набора проверяются при записи

- **WHEN** a `state_sets` row is inserted or updated
- **THEN** a `BEFORE INSERT OR UPDATE` trigger MUST reject the write if any element is absent from `states`

#### Scenario: Удаление состояния удаляет зависимые наборы

- **WHEN** a row is deleted from `states`
- **THEN** an `AFTER DELETE` trigger MUST delete every set whose `state_ids` contains it

#### Scenario: TRUNCATE словаря отклоняется

- **WHEN** `TRUNCATE states` is executed
- **THEN** a statement-level `ON TRUNCATE` trigger MUST reject the operation
- **THEN** the rejection MUST hold for `TRUNCATE ... CASCADE` as well

#### Scenario: Целостность проверяема постфактум

- **WHEN** an operator needs to verify that no set holds a dangling identifier
- **THEN** the repository MUST provide an audit query reporting sets whose `state_ids` contain an identifier absent from `states`

### Requirement: Deletion impact is observable before deletion

`ds-service` SHALL expose the blast radius of deleting a state before the deletion is performed,
because a shared set can carry hundreds of values across many components.

#### Scenario: Предпросмотр называет объём удаления

- **WHEN** `GET /ds/states/{id}/impact` is requested
- **THEN** the response MUST report the number of state sets to be deleted
- **THEN** the response MUST report the number of property values to be deleted
- **THEN** the response MUST report the number of affected components
- **THEN** the request MUST NOT modify any data

### Requirement: State sets are resolved through a single endpoint

`ds-service` SHALL expose a single endpoint that resolves a list of state identifiers into a set
identifier, creating the set when it does not exist. Clients SHALL NOT assemble the array
themselves.

#### Scenario: Resolve возвращает существующий набор

- **WHEN** `POST /ds/state-sets/resolve` receives a list of state identifiers matching an existing set
- **THEN** it MUST return the identifier of that set
- **THEN** it MUST NOT create a new row

#### Scenario: Resolve создаёт отсутствующий набор

- **WHEN** the list matches no existing set
- **THEN** the endpoint MUST create the set and return its identifier
- **THEN** the stored array MUST be canonicalized

#### Scenario: Неизвестное состояние отклоняется

- **WHEN** the list contains an identifier absent from `states`
- **THEN** the endpoint MUST fail with `400`
- **THEN** it MUST NOT create a set

#### Scenario: Импорт использует одну точку

- **WHEN** component configuration import needs a set
- **THEN** it MUST obtain it through the resolve endpoint
- **THEN** it MUST NOT write `state_sets` directly

## MODIFIED Requirements

### Requirement: State vocabulary is a table

`db-service` SHALL store the whole state vocabulary in a single table `states`, covering both
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

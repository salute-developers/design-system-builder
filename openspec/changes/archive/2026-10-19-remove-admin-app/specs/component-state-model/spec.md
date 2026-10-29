## REMOVED Requirements

### Requirement: State sets are constructed in one place

**Reason**: сценарий требования называл админку потребителем resolve-ручки; админка удалена.
**Migration**: нет; требование заменяется требованием «State sets are resolved through a single endpoint» с тем же контрактом.

## ADDED Requirements

### Requirement: State sets are resolved through a single endpoint

`db-service` SHALL expose a single endpoint that resolves a list of state identifiers into a set
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

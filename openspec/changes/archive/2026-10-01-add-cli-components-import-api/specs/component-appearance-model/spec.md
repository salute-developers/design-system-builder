## MODIFIED Requirements

### Requirement: Component name belongs to the component code

`db-service` SHALL treat the stored component name as the name used by component code, imported
from `uikit-compose-api-meta.json`. Appearance configurations SHALL NOT rewrite it.

#### Scenario: Имя пишет только импорт метаинформации кода

- **WHEN** the global layer of components is populated
- **THEN** the component name MUST be the name declared by `uikit-compose-api-meta.json`
- **THEN** seeds MUST use the same spelling as `uikit-compose-api-meta.json`
- **THEN** importing a component configuration MUST NOT create or rename a component

#### Scenario: Имя конфигурации выводится обратимо

- **WHEN** the component name is reported for a component package
- **THEN** it MUST be derived from the stored name by lowering camel-case boundaries to hyphens
- **THEN** the derivation MUST be verified by converting the result back and comparing it with the stored name

#### Scenario: Необратимое имя отклоняется

- **WHEN** converting the derived name back does not reproduce the stored name
- **THEN** the request MUST be rejected with a deterministic error naming the component
- **THEN** a name that cannot be derived MUST NOT be reported

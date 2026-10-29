# Spec Delta

## MODIFIED Requirements

### Requirement: Local web generation reads only local data

`npm run generate:components` in `js/cli` SHALL build the generator model only from local files and
SHALL NOT request the backend.

#### Scenario: Модель генератора собирается из выгрузки и web-данных

- **WHEN** developer runs `npm run generate:components`
- **THEN** CLI MUST read `meta.json` and configuration files from `<sdds>/components`
- **THEN** CLI MUST read `web-adapter.json` and `web-api-meta.json` from `<sdds>/web`
- **THEN** CLI MUST NOT read `component-configs.json`
- **THEN** `--components` and `--web` MUST override the directories

#### Scenario: Web-параметры и шаблоны

- **WHEN** CLI builds the API of a component
- **THEN** a property MUST be listed only when it has a value in the configurations and at least one entry in `web-api-meta.json` with the same `id` and without `state`
- **THEN** its web parameters MUST be those entries, including typography parts
- **THEN** a parameter template MUST be taken from `web-adapter.json` by component, style, property and parameter
- **THEN** the property type MUST be taken from the configuration value, with `gradient` treated as `color`

#### Scenario: Имя, описание и compose-связи

- **WHEN** `web-adapter.json` has an entry for a component
- **THEN** CLI MUST take the component name and description from it
- **THEN** CLI MUST pass its `compose` children to the generator as `compose` dependencies in the listed order
- **THEN** without an entry the name MUST be derived from the `meta.json` spelling and the description MUST be empty

#### Scenario: Окружение генератора

- **WHEN** developer runs `npm run generate:components`
- **THEN** CLI MUST load `js/.env` when it exists, so that `NPM_PACKAGE_SCOPE` reaches the generator
- **THEN** `generate:theme` and `generate:api-meta` MUST NOT require any environment variables

#### Scenario: Флаг без значений

- **WHEN** a boolean variation has no configuration entry
- **THEN** CLI MUST still pass the style `true` to the generator

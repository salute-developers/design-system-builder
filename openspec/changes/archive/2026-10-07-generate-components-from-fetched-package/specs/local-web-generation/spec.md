# Spec Delta

## Purpose

Определяет локальную генерацию web-пакета компонентов в `js/cli`: из каких локальных файлов собирается
модель генератора и где лежат web-данные, которые нужны только React.

## ADDED Requirements

### Requirement: Local web generation reads only local data

`npm run generate:components` in `js/cli` SHALL build the generator model only from local files and
SHALL NOT request the backend.

#### Scenario: Модель генератора собирается из выгрузки и web-данных

- **WHEN** developer runs `npm run generate:components`
- **THEN** CLI MUST read `meta.json` and configuration files from `<sdds>/components`
- **THEN** CLI MUST read `meta-template.json`, `meta-dependencies.json` and `web-api-meta.json` from `<sdds>/web`
- **THEN** CLI MUST NOT read `component-configs.json`
- **THEN** `--components` and `--web` MUST override the directories

#### Scenario: Web-параметры и шаблоны

- **WHEN** CLI builds the API of a component
- **THEN** a property MUST be listed only when it has a value in the configurations and at least one entry in `web-api-meta.json` with the same `id` and without `state`
- **THEN** its web parameters MUST be those entries, including typography parts
- **THEN** a parameter template MUST be taken from `meta-template.json` by component, style, property and parameter
- **THEN** the property type MUST be taken from the configuration value, with `gradient` treated as `color`

#### Scenario: Compose-связи раскладывают пакет

- **WHEN** `meta-dependencies.json` lists children for a component
- **THEN** CLI MUST pass them to the generator as `compose` dependencies in the listed order

#### Scenario: Флаг без значений

- **WHEN** a boolean variation has no configuration entry
- **THEN** CLI MUST still pass the style `true` to the generator

### Requirement: Web API meta default location

`npm run generate:api-meta` SHALL write `web-api-meta.json` to `<sdds>/web` when `--out` is omitted.

#### Scenario: Путь по умолчанию

- **WHEN** developer runs `generate:api-meta` without `--out`
- **THEN** CLI MUST write `<sdds>/web/web-api-meta.json`, where `<sdds>` is `--sdds` or `js/cli/.sdds`
- **THEN** CLI MUST create the directory when it is missing
- **THEN** passing both `--out` and `--sdds` MUST be rejected

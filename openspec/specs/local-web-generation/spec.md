# local-web-generation Specification

## Purpose
Определяет локальную генерацию web-пакета компонентов в `js/cli`: из каких локальных файлов собирается
модель генератора и где лежат web-данные, которые нужны только React.

## Requirements
### Requirement: Local web generation reads only local data

`npm run generate:components` in `js/cli` SHALL build the generator model only from local files and the
installed components package, and SHALL NOT request the backend.

#### Scenario: Модель генератора собирается из выгрузки и web-данных

- **WHEN** developer runs `npm run generate:components`
- **THEN** CLI MUST read `meta.json` and configuration files from `<sdds>/components`
- **THEN** CLI MUST read `web-adapter.json` from `<sdds>/web`
- **THEN** CLI MUST build the Style API mappings on every run from `@salutejs/plasma-new-hope` installed in `js/cli`, with the same code as `generate:api-meta`, and MUST NOT read `web-api-meta.json`
- **THEN** CLI MUST NOT read `component-configs.json`
- **THEN** `--components` and `--web` MUST override the directories

#### Scenario: Web-параметры и шаблоны

- **WHEN** CLI builds the API of a component
- **THEN** a property MUST be listed only when it has a value in the configurations and at least one mapping with the same `id` and without `state`
- **THEN** its web parameters MUST be those mappings, including typography parts
- **THEN** a parameter template MUST be taken from `web-adapter.json` by component, style, property and parameter
- **THEN** the property type MUST be taken from the configuration value, with `gradient` treated as `color`

#### Scenario: Имя, описание и compose-связи

- **WHEN** `web-adapter.json` has an entry for a component
- **THEN** CLI MUST take the component name and description from it
- **THEN** CLI MUST pass its `compose` children to the generator as `compose` dependencies in the listed order
- **THEN** without an entry the name MUST be derived from the `meta.json` spelling and the description MUST be empty

#### Scenario: Окружение генератора

- **WHEN** developer runs `npm run generate:theme` or `npm run generate:components`
- **THEN** CLI MUST load `js/.env` when it exists, so that `NPM_PACKAGE_SCOPE` reaches the generator
- **THEN** `generate:api-meta` MUST NOT require any environment variables

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

### Requirement: Local web generation output

`npm run generate:theme` and `npm run generate:components` SHALL generate the theme and the components
separately. Each command SHALL replace only its own part of the output directory (`--out`, default
`js/cli/output`).

#### Scenario: Исходники части

- **WHEN** developer runs `generate:theme` or `generate:components` without `--package`
- **THEN** CLI MUST replace only `src/theme` or `src/components` respectively and keep the other part
- **THEN** `src/index.ts` MUST export exactly what `src` contains: top-level components and the theme, if present

#### Scenario: Пакет части с --package

- **WHEN** developer runs either command with `--package`
- **THEN** CLI MUST build a package of that part only, the same way as the generation service (pacote: dependencies and `npm run build`)
- **THEN** the package name MUST be given by `--name`; without `--name` CLI MUST fail before generating anything
- **WHEN** a command runs without `--package`
- **THEN** `--name` MUST NOT be required, because the package name does not affect `src`
- **THEN** the archive MUST be written as `<scope>-<name>-<version>-theme.tgz` or `…-components.tgz`, so that archives of the parts do not overwrite each other
- **THEN** the temporary build directory MUST be removed, also when the build fails

#### Scenario: Пакет без темы

- **WHEN** the package has no theme
- **THEN** the build MUST skip copying theme CSS and MUST NOT export the theme
- **THEN** the full package of the generation service MUST build as before

### Requirement: Local web design system generation

`npm run generate:ds` SHALL generate the theme and the components in one run, combining `generate:theme` and
`generate:components`.

#### Scenario: Исходники дизайн-системы

- **WHEN** developer runs `generate:ds` without `--package`
- **THEN** CLI MUST replace `src/theme`, `src/components` and `src/index.ts` in the output directory
- **THEN** the result MUST be identical to running `generate:theme` and `generate:components`

#### Scenario: Полный пакет с --package

- **WHEN** developer runs `generate:ds --package`
- **THEN** CLI MUST build one package with the theme and the components, the same way as the generation service
- **THEN** the archive MUST be written as `<scope>-<name>-<version>.tgz` without a part suffix

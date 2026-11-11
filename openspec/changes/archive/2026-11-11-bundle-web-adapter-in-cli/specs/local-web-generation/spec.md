## MODIFIED Requirements

### Requirement: Local web generation reads only local data

`npm run generate:components` in `js/cli` SHALL build the generator model only from local files and the
installed components package, and SHALL NOT request the backend.

#### Scenario: Модель генератора собирается из выгрузки и web-данных

- **WHEN** developer runs `npm run generate:components` or `npm run generate:ds`
- **THEN** CLI MUST read `meta.json` and configuration files from `<sdds>/components`
- **THEN** CLI MUST read `web-adapter.json` from `js/cli/src/data` of the running generator, not from `<sdds>/web`
- **THEN** CLI MUST build the Style API mappings on every run from `@salutejs/plasma-new-hope` installed together with the generator (in `js/cli` or in the global package), with the same code as `generate:api-meta`, and MUST NOT read `web-api-meta.json`
- **THEN** CLI MUST NOT read `component-configs.json`
- **THEN** `--components` MUST override the components directory
- **THEN** `--web <directory>` MUST make CLI read `<directory>/web-adapter.json` instead of the bundled file

#### Scenario: Выгрузка web-адаптера из базы не используется

- **WHEN** `<sdds>/web/web-adapter.json` written by `dsbuilder components fetch` exists and `--web` is not passed
- **THEN** CLI MUST NOT read it
- **THEN** names, descriptions, templates and `compose` children MUST come from the bundled `web-adapter.json`

#### Scenario: Web-параметры и шаблоны

- **WHEN** CLI builds the API of a component
- **THEN** a property MUST be listed only when it has a value in the configurations and at least one mapping with the same `id` and without `state`
- **THEN** its web parameters MUST be those mappings, including typography parts
- **THEN** a parameter template MUST be taken from `web-adapter.json` by component, style, property and parameter
- **THEN** the property type MUST be taken from the configuration value, with `gradient` treated as `color`

#### Scenario: Стиль без значений

- **WHEN** a configuration lists a style in `variations` without the `props` field
- **THEN** CLI MUST treat the style as having no values and MUST NOT fail
- **THEN** the style MUST still be passed to the generator

#### Scenario: Имя, описание и compose-связи

- **WHEN** `web-adapter.json` has an entry for a component
- **THEN** CLI MUST take the component name and description from it
- **THEN** CLI MUST pass its `compose` children to the generator as `compose` dependencies in the listed order
- **THEN** without an entry the name MUST be derived from the `meta.json` spelling and the description MUST be empty

#### Scenario: Окружение генератора

- **WHEN** developer runs `npm run generate:theme`, `npm run generate:components` or `npm run generate:ds`
- **THEN** CLI MUST load `js/.env` when it exists, but MUST NOT require it
- **THEN** without `NPM_PACKAGE_SCOPE` the generator MUST use the scope `@sddsjs`
- **THEN** `generate:api-meta` MUST NOT require any environment variables

#### Scenario: Флаг без значений

- **WHEN** a boolean variation has no configuration entry
- **THEN** CLI MUST still pass the style `true` to the generator

## ADDED Requirements

### Requirement: Статический web-адаптер CLI совпадает с копией web-плагина

`js/cli/src/data/web-adapter.json` SHALL быть побайтно идентичен `js/apps/preview-web-plugin/src/data/web-adapter.json`. Файл SHALL входить в публикуемый пакет генератора. Шаблоны web-параметров нового компонента SHALL добавляться в обе копии одинаково и MUST NOT заноситься в базу `ds-service`.

#### Scenario: Копии совпадают

- **WHEN** запускаются тесты `js/cli`
- **THEN** тест MUST сравнить обе копии `web-adapter.json` и упасть, если они различаются

#### Scenario: Файл в опубликованном генераторе

- **WHEN** генератор установлен из npm-пакета `@sddsjs/design-system-builder-generator`
- **THEN** `generate:components` MUST найти `web-adapter.json` внутри установленного пакета

#### Scenario: Запись нового компонента

- **WHEN** в базовую ДС добавлен web-компонент, у свойств которого есть шаблоны многозначных значений
- **THEN** обе копии MUST содержать запись компонента с `componentName`, `name` и шаблонами по стилю
- **THEN** записи MUST быть упорядочены по `componentName`

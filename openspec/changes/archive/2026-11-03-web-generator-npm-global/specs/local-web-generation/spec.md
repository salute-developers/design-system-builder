## MODIFIED Requirements

### Requirement: Local web generation reads only local data

`npm run generate:components` in `js/cli` SHALL build the generator model only from local files and the
installed components package, and SHALL NOT request the backend.

#### Scenario: Модель генератора собирается из выгрузки и web-данных

- **WHEN** developer runs `npm run generate:components`
- **THEN** CLI MUST read `meta.json` and configuration files from `<sdds>/components`
- **THEN** CLI MUST read `web-adapter.json` from `<sdds>/web`
- **THEN** CLI MUST build the Style API mappings on every run from `@salutejs/plasma-new-hope` installed together with the generator (in `js/cli` or in the global package), with the same code as `generate:api-meta`, and MUST NOT read `web-api-meta.json`
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

- **WHEN** developer runs `npm run generate:theme`, `npm run generate:components` or `npm run generate:ds`
- **THEN** CLI MUST load `js/.env` when it exists, but MUST NOT require it
- **THEN** without `NPM_PACKAGE_SCOPE` the generator MUST use the scope `@sddsjs`
- **THEN** `generate:api-meta` MUST NOT require any environment variables

#### Scenario: Флаг без значений

- **WHEN** a boolean variation has no configuration entry
- **THEN** CLI MUST still pass the style `true` to the generator

### Requirement: Generator code is part of js/cli

Код генерации темы, компонентов и заготовки пакета SHALL находиться в `js/cli/src/generator` и подключаться
модулями `js/cli` через статические ES-импорты. `js/cli` SHALL NOT зависеть от каталога `js/services/generator`
и от чужого `node_modules`.

#### Scenario: Генерация без каталога сервиса

- **WHEN** каталога `js/services/generator` нет, а зависимости установлены только в `js/cli` (`npm ci` в `js/cli`)
- **THEN** `generate:theme`, `generate:components`, `generate:ds` с `--package` и без него MUST завершаться успешно
- **THEN** `npm run test:cli` MUST проходить

#### Scenario: Нативные импорты

- **WHEN** модуль `js/cli/src` использует генератор
- **THEN** он MUST импортировать его статическим `import` из `./generator/...`
- **THEN** `js/cli/src` MUST NOT содержать `createRequire` для модулей генератора

#### Scenario: Временный каталог сборки

- **WHEN** CLI собирает пакет
- **THEN** временный каталог MUST создаваться в системном временном каталоге (`os.tmpdir()`), а не в каталоге генератора
- **THEN** генерация MUST работать, когда каталог установленного генератора недоступен для записи
- **THEN** временный каталог MUST удаляться после генерации, в том числе при ошибке

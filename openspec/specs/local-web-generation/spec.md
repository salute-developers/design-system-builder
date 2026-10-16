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
- **THEN** CLI MUST build a package of that part only with pacote, which runs only `prepare` (`npm run build` of the package) with tools resolved from `js/cli/node_modules`
- **THEN** the package name MUST be given by `--name`; without `--name` CLI MUST fail before generating anything
- **WHEN** a command runs without `--package`
- **THEN** `--name` MUST NOT be required, because the package name does not affect `src`
- **THEN** the archive MUST be written as `<scope>-<name>-<version>-theme.tgz` or `…-components.tgz`, so that archives of the parts do not overwrite each other
- **THEN** the temporary build directory MUST be removed, also when the build fails

#### Scenario: Пакет без темы

- **WHEN** the package has no theme
- **THEN** the build MUST skip copying theme CSS and MUST NOT export the theme
- **THEN** the full package built by `generate:ds --package` MUST build as before

### Requirement: Local web design system generation

`npm run generate:ds` SHALL generate the theme and the components in one run, combining `generate:theme` and
`generate:components`.

#### Scenario: Исходники дизайн-системы

- **WHEN** developer runs `generate:ds` without `--package`
- **THEN** CLI MUST replace `src/theme`, `src/components` and `src/index.ts` in the output directory
- **THEN** the result MUST be identical to running `generate:theme` and `generate:components`

#### Scenario: Полный пакет с --package

- **WHEN** developer runs `generate:ds --package`
- **THEN** CLI MUST build one package with the theme and the components with pacote, the same way as a part package
- **THEN** the archive MUST be written as `<scope>-<name>-<version>.tgz` without a part suffix

### Requirement: Local web generation includes every theme

`npm run generate:theme` и `npm run generate:ds` SHALL генерировать в `src/theme` все темы из `.sdds/tenants`,
когда параметр `--tenant` не задан. Темой SHALL считаться каталог в `.sdds/tenants`, содержащий `meta.json`;
`.sdds/config.json` для генерации всех тем SHALL NOT требоваться.

#### Scenario: Несколько тем в одном пакете

- **WHEN** в `.sdds/tenants` лежат каталоги тем `brand_light` и `brand_night` и разработчик запускает `generate:theme` без `--tenant`
- **THEN** CLI MUST записать для каждой темы `themes/<имя>__dark.ts`, `themes/<имя>__light.ts`, `css/<имя>__dark.css`, `css/<имя>__light.css` и `css/<имя>.module.css`
- **THEN** `themes/index.ts` MUST экспортировать тёмный и светлый вариант каждой темы
- **THEN** порядок экспортов MUST совпадать с порядком имён каталогов тем по возрастанию

#### Scenario: Одна тема

- **WHEN** в `.sdds/tenants` один каталог темы
- **THEN** содержимое `src/theme` MUST быть таким же, как до изменения

#### Scenario: Каталог без данных темы

- **WHEN** в `.sdds/tenants` есть каталог без `meta.json`, например оставшийся от удалённой темы, скрытый каталог или файл `palette.json`
- **THEN** CLI MUST пропустить его и MUST NOT считать темой

#### Scenario: Без config.json

- **WHEN** в `.sdds` нет `config.json`, но есть каталоги тем и `tenants/palette.json`
- **THEN** генерация темы MUST завершиться успешно

#### Scenario: Тем нет

- **WHEN** в `.sdds/tenants` нет ни одного каталога с `meta.json`
- **THEN** CLI MUST завершиться ошибкой с путём к каталогу и MUST NOT изменять каталог результата

#### Scenario: Ограничение одной темой

- **WHEN** разработчик передаёт `--tenant <name>` и в `.sdds/config.json` есть тема с таким именем
- **THEN** CLI MUST сгенерировать только эту тему из каталога, указанного в её `directoryPath`, как до изменения
- **WHEN** `config.json` отсутствует или темы с таким именем в нём нет
- **THEN** CLI MUST сгенерировать только тему из каталога `.sdds/tenants/<name>`
- **THEN** имя, не найденное ни в `config.json`, ни среди каталогов, MUST приводить к ошибке до записи файлов

#### Scenario: Расположение палитры

- **WHEN** в `.sdds/config.json` задан `palettePath`
- **THEN** CLI MUST читать палитру по этому пути в обоих режимах, как до изменения
- **WHEN** `config.json` отсутствует или `palettePath` в нём не задан
- **THEN** CLI MUST читать палитру из `.sdds/tenants/palette.json`

#### Scenario: Дизайн-система целиком

- **WHEN** разработчик запускает `generate:ds` без `--tenant`
- **THEN** результат в `src/theme` MUST совпадать с результатом `generate:theme` для тех же данных

#### Scenario: Пакет с несколькими темами

- **WHEN** разработчик запускает `generate:theme` или `generate:ds` с `--package` для нескольких тем
- **THEN** собранный пакет MUST содержать CSS и экспорты каждой темы

### Requirement: Default theme for token fallbacks

Файл `tokens/index.ts` SHALL быть один на пакет; запасные значения переменных в нём SHALL браться из темы
по умолчанию.

#### Scenario: Тема по умолчанию не задана

- **WHEN** параметр `--default-tenant` не передан
- **THEN** темой по умолчанию MUST быть первая из генерируемых тем по имени каталога

#### Scenario: Тема по умолчанию задана

- **WHEN** разработчик передаёт `--default-tenant <name>`
- **THEN** запасные значения в `tokens/index.ts` MUST браться из темы `<name>`, найденной по тем же правилам, что и для `--tenant`
- **THEN** имя, которого нет среди генерируемых тем, MUST приводить к ошибке до записи файлов

#### Scenario: Повторная генерация

- **WHEN** разработчик повторяет генерацию без изменения `.sdds`
- **THEN** содержимое `src/theme` MUST совпадать с предыдущим

### Requirement: Theme names are validated before generation

CLI SHALL проверять имена тем из их `meta.json` до записи файлов.

#### Scenario: Совпадающие имена

- **WHEN** у двух генерируемых тем одинаковое имя в `meta.json`, в том числе с точностью до регистра букв
- **THEN** CLI MUST завершиться ошибкой с именем темы и MUST NOT изменять каталог результата

#### Scenario: Имя не подходит для кода

- **WHEN** имя темы не является допустимым идентификатором JavaScript
- **THEN** CLI MUST завершиться ошибкой с именем темы и MUST NOT изменять каталог результата

#### Scenario: Нет данных темы

- **WHEN** у каталога темы нет web-значений или файла цветов
- **THEN** CLI MUST завершиться ошибкой с именем темы и MUST NOT изменять каталог результата

#### Scenario: Нет палитры

- **WHEN** общей палитры нет
- **THEN** CLI MUST завершиться ошибкой с путём к палитре и MUST NOT изменять каталог результата

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
- **THEN** временный каталог MUST создаваться внутри `js/cli` и MUST NOT попадать в Git
- **THEN** скрипт `lint` пакета MUST находить `eslint` в `js/cli/node_modules`


## ADDED Requirements

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

## MODIFIED Requirements

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

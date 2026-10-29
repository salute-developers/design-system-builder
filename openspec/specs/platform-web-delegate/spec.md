# platform-web-delegate Specification

## Purpose
Определяет делегат платформы React: как общий CLI `dsbuilder` запускает web-генератор `js/cli`.

## Requirements

### Requirement: Web toolchain delegate

CLI SHALL register a platform delegate with toolchain id `web` that serves the `react` target platform through
the npm scripts of the web generator `js/cli` in the DS Builder repository.

#### Scenario: Делегат объявляет себя

- **WHEN** CLI builds its platform delegate registry
- **THEN** the registry MUST resolve `react` to the `web` toolchain
- **THEN** the `web` toolchain MUST declare the capabilities `THEME`, `COMPONENTS` and `DESIGN_SYSTEM`
- **THEN** `DOCS_AGGREGATE` MUST be reported as unsupported without starting a process

#### Scenario: Тема и компоненты генерируются раздельно

- **WHEN** the delegate runs the `THEME` capability
- **THEN** it MUST run `npm run generate:theme -- --sdds <workspace .sdds> --out <output>`
- **WHEN** the delegate runs the `COMPONENTS` capability
- **THEN** it MUST run `npm run generate:components -- --sdds <workspace .sdds> --out <output>`
- **WHEN** the delegate runs the `DESIGN_SYSTEM` capability
- **THEN** it MUST run `npm run generate:ds -- --sdds <workspace .sdds> --out <output>` once
- **THEN** `<output>` MUST be the `--output` directory when it is given, otherwise `<workspace>/output`, where the workspace is the parent of `.sdds`
- **THEN** passthrough arguments (for example `--package`) MUST be passed as is after `--out`
- **THEN** the working directory MUST be the web generator directory and the output MUST go to the terminal

#### Scenario: Результат без --output

- **WHEN** разработчик запускает `dsbuilder ds generate --platform react` без `--output` в проекте с `/repo/.sdds`
- **THEN** генератор MUST получить `--out /repo/output`
- **THEN** результат MUST NOT попадать в каталог генератора `js/cli`

### Requirement: Web tool discovery

The delegate SHALL find the web generator only by an explicit path: `--tool`, then the `DSBUILDER_WEB_TOOL`
environment variable. A directory is the web generator when it contains `package.json`. `npm` SHALL be found in
`PATH`. There is no installer.

#### Scenario: Инструмент не найден

- **WHEN** neither `--tool` nor `DSBUILDER_WEB_TOOL` points to a directory with `package.json`
- **THEN** the delegate MUST report a missing toolchain naming both `DSBUILDER_WEB_TOOL` and `--tool`
- **WHEN** `--tool` is given and invalid
- **THEN** the hint MUST name that path
- **WHEN** `DSBUILDER_WEB_TOOL` is set and points to a directory without `package.json`
- **THEN** the hint MUST name that path and `DSBUILDER_WEB_TOOL`

#### Scenario: Doctor

- **WHEN** `toolchain doctor --platform react` runs and the generator and `npm` are found
- **THEN** it MUST report ready with the generator directory and the `npm` version, capturing `npm --version` output

### Requirement: Обнаружение web-инструмента на Windows

Web-делегат SHALL находить `npm.cmd` в каталогах Windows `PATH` и запускать существующие команды генератора без изменения их аргументов.

#### Scenario: Поиск npm

- **WHEN** `PATH` содержит несколько каталогов, разделённых `;`, и один из них содержит `npm.cmd`
- **THEN** `toolchain doctor --platform react` MUST использовать найденный сценарий и получить версию npm

#### Scenario: Запуск генератора

- **WHEN** пользователь запускает `dsbuilder.exe ds generate --platform react` с настроенным `DSBUILDER_WEB_TOOL`
- **THEN** делегат MUST запустить нужный сценарий npm с путями Windows и сохранить выходной код
- **THEN** CLI MUST NOT требовать Node.js до вызова команды, использующей web-генератор

# platform-web-delegate Specification

## Purpose
Определяет делегат платформы React: как общий CLI `dsbuilder` запускает web-генератор `js/cli`.
## Requirements
### Requirement: Web toolchain delegate

CLI SHALL register a platform delegate with toolchain id `web` that serves the `react` target platform through
the web generator: the npm scripts of `js/cli` when a generator directory is given explicitly, otherwise the
installed `dsbuilder-web-generator`: the managed installation or the one from global npm.

#### Scenario: Делегат объявляет себя

- **WHEN** CLI builds its platform delegate registry
- **THEN** the registry MUST resolve `react` to the `web` toolchain
- **THEN** the `web` toolchain MUST declare the capabilities `THEME`, `COMPONENTS` and `DESIGN_SYSTEM`
- **THEN** `DOCS_AGGREGATE` MUST be reported as unsupported without starting a process

#### Scenario: Тема и компоненты генерируются раздельно

- **WHEN** the delegate runs the `THEME` capability with a generator directory
- **THEN** it MUST run `npm run generate:theme -- --sdds <workspace .sdds> --out <output>`
- **WHEN** the delegate runs the `COMPONENTS` capability with a generator directory
- **THEN** it MUST run `npm run generate:components -- --sdds <workspace .sdds> --out <output>`
- **WHEN** the delegate runs the `DESIGN_SYSTEM` capability with a generator directory
- **THEN** it MUST run `npm run generate:ds -- --sdds <workspace .sdds> --out <output>` once
- **THEN** `<output>` MUST be the `--output` directory when it is given, otherwise `<workspace>/output`, where the workspace is the parent of `.sdds`
- **THEN** passthrough arguments (for example `--package`) MUST be passed as is after `--out`
- **THEN** the working directory MUST be the web generator directory and the output MUST go to the terminal

#### Scenario: Запуск установленного генератора

- **WHEN** the delegate runs `THEME`, `COMPONENTS` or `DESIGN_SYSTEM` without a generator directory
- **THEN** it MUST run `dsbuilder-web-generator <theme|components|ds> --sdds <workspace .sdds> --out <output>` followed by the passthrough arguments
- **THEN** `<output>` MUST be chosen by the same rule as for the generator directory
- **THEN** the working directory MUST be the workspace and the output MUST go to the terminal

#### Scenario: Окружение передаётся генератору

- **WHEN** the user sets `NPM_PACKAGE_SCOPE` before running `dsbuilder ... --platform react`
- **THEN** the generator process MUST receive that variable unchanged

#### Scenario: Результат без --output

- **WHEN** разработчик запускает `dsbuilder ds generate --platform react` без `--output` в проекте с `/repo/.sdds`
- **THEN** генератор MUST получить `--out /repo/output`
- **THEN** результат MUST NOT попадать в каталог генератора `js/cli`

### Requirement: Web tool discovery

The delegate SHALL find the web generator in this order: the `--tool` directory, then the `DSBUILDER_WEB_TOOL`
directory, then the managed installation `~/.dsbuilder/toolchains/web`, then `dsbuilder-web-generator` in `PATH`,
then in the bin directory of the global npm prefix. A directory is the web generator when it contains
`package.json`. The home directory SHALL be taken from `HOME`, on Windows from `USERPROFILE` when `HOME` is not set.
`npm` SHALL be found in `PATH`. `DSBUILDER_WEB_TOOL` SHALL NOT be required.

#### Scenario: Управляемая установка без переменных

- **WHEN** neither `--tool` nor `DSBUILDER_WEB_TOOL` is set and `dsbuilder toolchain install web` has installed the generator
- **THEN** the delegate MUST use `~/.dsbuilder/toolchains/web/bin/dsbuilder-web-generator`
- **THEN** it MUST prefer that executable over another `dsbuilder-web-generator` in `PATH`

#### Scenario: Генератор из глобального npm

- **WHEN** there is no managed installation and `dsbuilder-web-generator` is in `PATH`
- **THEN** the delegate MUST use that executable

#### Scenario: Явный путь важнее установленного генератора

- **WHEN** `--tool` or `DSBUILDER_WEB_TOOL` is set and the generator is also installed
- **THEN** the delegate MUST use the explicit directory

#### Scenario: Глобальный prefix не в PATH

- **WHEN** there is no managed installation, `dsbuilder-web-generator` is absent from `PATH` but present in the bin directory of `npm prefix -g`
- **THEN** the delegate MUST use that executable

#### Scenario: Инструмент не найден

- **WHEN** neither `--tool` nor `DSBUILDER_WEB_TOOL` is set and the generator is not installed
- **THEN** the delegate MUST report a missing toolchain naming `dsbuilder toolchain install web` and the Node.js 22+ requirement
- **WHEN** `--tool` is given and invalid
- **THEN** the hint MUST name that path
- **WHEN** `DSBUILDER_WEB_TOOL` is set and points to a directory without `package.json`
- **THEN** the hint MUST name that path and `DSBUILDER_WEB_TOOL`
- **THEN** the delegate MUST NOT silently fall back to an installed executable

#### Scenario: Doctor

- **WHEN** `toolchain doctor --platform react` runs with a generator directory and `npm` is found
- **THEN** it MUST report ready with the generator directory and the `npm` version, capturing `npm --version` output
- **WHEN** `toolchain doctor --platform react` runs with an installed executable
- **THEN** it MUST report ready with the executable path and the version printed by `dsbuilder-web-generator --version`

### Requirement: Обнаружение web-инструмента на Windows

Web-делегат SHALL находить `npm.cmd` и `dsbuilder-web-generator.cmd` в каталогах Windows `PATH` и запускать
команды генератора без изменения их аргументов.

#### Scenario: Поиск npm

- **WHEN** `PATH` содержит несколько каталогов, разделённых `;`, и один из них содержит `npm.cmd`
- **THEN** `toolchain doctor --platform react` MUST использовать найденный сценарий и получить версию npm

#### Scenario: Поиск установленного генератора

- **WHEN** `DSBUILDER_WEB_TOOL` не задана, а `%USERPROFILE%\.dsbuilder\toolchains\web\dsbuilder-web-generator.cmd` существует
- **THEN** делегат MUST запустить этот сценарий
- **WHEN** управляемой установки нет, а `PATH` содержит каталог с `dsbuilder-web-generator.cmd`
- **THEN** делегат MUST запустить сценарий из `PATH`

#### Scenario: Запуск генератора

- **WHEN** пользователь запускает `dsbuilder.exe ds generate --platform react` с настроенным `DSBUILDER_WEB_TOOL` либо с установленным генератором
- **THEN** делегат MUST запустить нужную команду с путями Windows и сохранить выходной код
- **THEN** CLI MUST NOT требовать Node.js до вызова команды, использующей web-генератор

### Requirement: Установщик toolchain web

CLI SHALL регистрировать установщик toolchain `web`, который ставит `@sddsjs/design-system-builder-generator`
в каталог пользователя `~/.dsbuilder/toolchains/web` командой `npm install --global --prefix <каталог>`.
Установка SHALL NOT требовать прав администратора и SHALL NOT менять настройки npm пользователя.

#### Scenario: Последняя версия

- **WHEN** пользователь запускает `dsbuilder toolchain install web`
- **THEN** CLI MUST выполнить `npm install --global --prefix ~/.dsbuilder/toolchains/web @sddsjs/design-system-builder-generator@latest`
- **THEN** CLI MUST напечатать установленную версию из `dsbuilder-web-generator --version` и путь к исполняемому файлу в этом каталоге

#### Scenario: Системный Node.js без прав на глобальный каталог

- **WHEN** глобальный каталог npm (например, `/usr/local/lib/node_modules`) недоступен пользователю для записи
- **THEN** установка MUST завершиться успешно без `sudo` и без изменения `npm config`

#### Scenario: Конкретная версия и локальный архив

- **WHEN** пользователь запускает `dsbuilder toolchain install web --version 1.2.3`
- **THEN** CLI MUST установить `@sddsjs/design-system-builder-generator@1.2.3` в тот же каталог
- **WHEN** пользователь запускает `dsbuilder toolchain install web --from <путь к .tgz или каталогу>`
- **THEN** CLI MUST передать этот путь npm без обращения к реестру за другой версией

#### Scenario: Нет Node.js

- **WHEN** `npm` не найден в `PATH`
- **THEN** установка MUST завершиться ошибкой с подсказкой установить Node.js 22+ и MUST NOT запускать процессы

#### Scenario: Ошибка npm

- **WHEN** npm завершается ненулевым кодом, например без сети
- **THEN** CLI MUST вернуть ошибку с кодом npm и MUST NOT советовать менять глобальный prefix npm


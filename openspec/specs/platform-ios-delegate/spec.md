# platform-ios-delegate Specification

## Purpose
TBD - created by archiving change platform-ios-delegate. Update Purpose after archive.
## Requirements
### Requirement: iOS toolchain delegate

CLI SHALL register a platform delegate with toolchain id `ios` that serves the `swiftui` target platform through the `dsbuilder-ios` tool.

#### Scenario: Делегат объявляет себя

- **WHEN** CLI builds its platform delegate registry
- **THEN** the registry MUST resolve `swiftui` to the `ios` toolchain
- **THEN** the `ios` toolchain MUST declare the capabilities `THEME` and `DOCS_AGGREGATE`
- **THEN** `toolchain list` MUST show it without any additional configuration

#### Scenario: Генерация темы

- **WHEN** the delegate runs the `THEME` capability
- **THEN** it MUST invoke the tool as `theme generate --sdds <sddsDir>`
- **THEN** it MUST append `--output <dir>` when the command was given an output directory
- **THEN** it MUST append passthrough arguments unchanged, after the derived ones
- **THEN** it MUST run the tool in the workspace directory with inherited stdio

#### Scenario: Агрегация документации

- **WHEN** the delegate runs the `DOCS_AGGREGATE` capability
- **THEN** it MUST invoke the tool as `docs aggregate --sdds <sddsDir>`
- **THEN** the tool MUST receive the same output and passthrough handling as the theme capability

#### Scenario: Компоненты генерируются вместе с темой

- **WHEN** the delegate is asked for the `COMPONENTS` capability
- **THEN** it MUST return an unsupported result naming `theme generate`
- **THEN** it MUST NOT start any process

#### Scenario: Результат инструмента

- **WHEN** the tool exits with code `0`
- **THEN** the delegate MUST report completion naming the `.sdds` directory it worked from
- **WHEN** the tool exits with a non-zero code
- **THEN** the delegate MUST report failure carrying that exit code
- **WHEN** the tool cannot be started
- **THEN** the delegate MUST report a missing toolchain instead of a failure

### Requirement: iOS tool discovery

The iOS delegate SHALL locate `dsbuilder-ios` in a fixed order and report every checked location when it is absent.

#### Scenario: Порядок поиска

- **WHEN** the delegate needs the tool
- **THEN** it MUST use the `--tool` path when the command provided one
- **THEN** it MUST otherwise use `DSBUILDER_IOS_TOOL` when that variable points at an existing file
- **THEN** it MUST otherwise use `~/.dsbuilder/toolchains/ios/current/dsbuilder-ios`
- **THEN** it MUST otherwise use the first `dsbuilder-ios` found in `PATH`, keeping the order of `PATH`

#### Scenario: Явный путь не подменяется

- **WHEN** `--tool` points at a path that does not exist
- **THEN** the delegate MUST report a missing toolchain instead of falling back to another location

#### Scenario: Установленные версии не угадываются

- **WHEN** several versions are installed under `~/.dsbuilder/toolchains/ios`
- **THEN** the delegate MUST use only the one published at `current`
- **THEN** it MUST NOT infer the newest version from directory names, because iOS release tags are dates

#### Scenario: Инструмент не найден

- **WHEN** the tool is in none of the checked locations
- **THEN** the delegate MUST report a missing toolchain listing every checked location and naming `--tool`

### Requirement: iOS toolchain doctor

The iOS delegate SHALL report the state of its tool without generating anything.

#### Scenario: Инструмент готов

- **WHEN** `toolchain doctor` runs and the tool answers `--version` with exit code `0`
- **THEN** the delegate MUST report a ready toolchain with the resolved executable path and the reported version
- **THEN** the version output MUST be captured rather than printed to the terminal

#### Scenario: Инструмент непригоден

- **WHEN** the tool is absent, cannot be started, or `--version` exits non-zero
- **THEN** the delegate MUST report a missing toolchain with the reason
- **THEN** `toolchain doctor` MUST exit with a non-zero code


# Spec Delta

## MODIFIED Requirements

### Requirement: iOS toolchain delegate

CLI SHALL register a platform delegate with toolchain id `ios` that serves the `swiftui` target platform through the `dsbuilder-ios` tool.

#### Scenario: Делегат объявляет себя

- **WHEN** CLI builds its platform delegate registry
- **THEN** the registry MUST resolve `swiftui` to the `ios` toolchain
- **THEN** the `ios` toolchain MUST declare the capabilities `THEME`, `DOCS_AGGREGATE` and `DESIGN_SYSTEM`
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

#### Scenario: Дизайн-система целиком

- **WHEN** the delegate runs the `DESIGN_SYSTEM` capability
- **THEN** it MUST run the same theme generation as for `THEME`, because component variations are generated together with the theme

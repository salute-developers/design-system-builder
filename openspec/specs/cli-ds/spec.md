# cli-ds Specification

## Purpose
Определяет группу команд `dsbuilder ds`: загрузку и генерацию дизайн-системы целиком — темы и компонентов.

## Requirements
### Requirement: CLI ds fetch command

CLI SHALL provide `dsbuilder ds fetch` that runs `theme fetch` and then `components fetch` with the same
options of project context, API URL and credential.

#### Scenario: Тема, затем компоненты

- **WHEN** developer runs `dsbuilder ds fetch`
- **THEN** CLI MUST fetch the themes first and the component configurations second
- **THEN** both MUST use the same `--api-url`, `--api-key`, `--design-system` and `--project-key-env`
- **THEN** `--platform` MUST be passed to the component fetch, `--destination` to the theme fetch and `--to` to the component fetch
- **THEN** the output MUST contain the results of both fetches in the same format as the separate commands

#### Scenario: Отказ загрузки темы

- **WHEN** the theme fetch fails
- **THEN** CLI MUST print the failure, exit with code 1 and MUST NOT fetch the components

### Requirement: CLI ds generate command

CLI SHALL provide `dsbuilder ds generate` that asks the platform delegate for the `DESIGN_SYSTEM` capability in
one run, with the same options as `theme generate` and `components generate`.

#### Scenario: Один вызов инструмента

- **WHEN** developer runs `dsbuilder ds generate`
- **THEN** CLI MUST resolve the platform the same way as the other generate commands
- **THEN** CLI MUST run the delegate once with `DESIGN_SYSTEM`, passing `--output`, `--tool` and the arguments after `--` unchanged
- **THEN** combining the theme and the components MUST be done by the platform tool, not by CLI

#### Scenario: Один пакет для React

- **WHEN** developer runs `dsbuilder ds generate --platform react -- --package`
- **THEN** the result MUST be one package with the theme and the components

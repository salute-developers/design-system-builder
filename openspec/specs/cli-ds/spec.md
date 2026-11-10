# cli-ds Specification

## Purpose
Определяет группу команд `dsbuilder ds`: загрузку и генерацию дизайн-системы целиком — темы и компонентов.

## Requirements

### Requirement: CLI ds fetch command

CLI SHALL предоставлять `dsbuilder ds fetch`, последовательно выполняющий загрузку темы и компонентов с одним выбранным контекстом, API URL, типом учётных данных и пользователем согласно общему выбору PAT/OAuth.

#### Scenario: Тема, затем компоненты

- **WHEN** пользователь запускает `dsbuilder ds fetch`
- **THEN** CLI MUST сначала загрузить темы, затем конфигурации компонентов
- **AND** обе загрузки MUST использовать один контекст из `--design-system` либо локальной конфигурации и один API URL из общего resolver
- **AND** выбранный через `--api-key`, окружение или OAuth-сессию тип учётных данных и пользователь MUST сохраняться для обеих загрузок
- **AND** `--platform` MUST передаваться загрузке компонентов, `--destination` — загрузке темы, `--to` — загрузке компонентов
- **AND** вывод MUST содержать результаты обеих загрузок в формате отдельных команд

#### Scenario: Отказ загрузки темы

- **WHEN** загрузка темы завершается ошибкой
- **THEN** CLI MUST вывести ошибку и завершиться с кодом 1 без загрузки компонентов

#### Scenario: PAT отклонён при загрузке компонентов

- **WHEN** после успешной загрузки темы запрос компонентов с выбранным PAT получает `401` или `403`
- **THEN** CLI MUST вернуть соответственно `PAT_INVALID` или `FORBIDDEN` без OAuth refresh и смены учётных данных

#### Scenario: Прежние параметры ключа

- **WHEN** пользователь передаёт `--project-key-env`
- **THEN** команда MUST отклонить прежний параметр до сетевых запросов с указанием перехода на `--api-key` или `DSBUILDER_API_KEY`

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

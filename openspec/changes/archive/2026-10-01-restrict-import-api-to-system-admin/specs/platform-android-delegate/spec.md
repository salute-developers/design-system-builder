## MODIFIED Requirements

### Requirement: Android toolchain delegate

CLI SHALL register a platform delegate with toolchain id `android` that serves the `compose` and `android-view`
target platforms through the `dsBuilder` Gradle plugin (`sdds-core/plugin_theme_builder` in `plasma-android`).

#### Scenario: Делегат объявляет себя

- **WHEN** CLI builds its platform delegate registry
- **THEN** the registry MUST resolve both `compose` and `android-view` to the `android` toolchain
- **THEN** the `android` toolchain MUST declare the capabilities `THEME`, `COMPONENTS` and `DOCS_AGGREGATE`
- **THEN** `toolchain list` MUST show it without any additional configuration

#### Scenario: Генерация темы

- **WHEN** the delegate runs the `THEME` capability for `compose`
- **THEN** it MUST invoke the Gradle task `generateComposeTheme`
- **WHEN** the delegate runs the `THEME` capability for `android-view`
- **THEN** it MUST invoke the Gradle task `generateViewTheme`

#### Scenario: Генерация компонентов

- **WHEN** the delegate runs the `COMPONENTS` capability for `compose`
- **THEN** it MUST invoke the Gradle task `generateComposeComponents`
- **WHEN** the delegate runs the `COMPONENTS` capability for `android-view`
- **THEN** it MUST invoke the Gradle task `generateViewComponents`

#### Scenario: Агрегация документации

- **WHEN** the delegate runs the `DOCS_AGGREGATE` capability for `compose`
- **THEN** it MUST invoke the Gradle task `aggregateComposeDocumentation`
- **WHEN** the delegate runs the `DOCS_AGGREGATE` capability for `android-view`
- **THEN** it MUST invoke the Gradle task `aggregateViewDocumentation`

#### Scenario: Инструмент вызывается по месту рабочей копии

- **WHEN** the delegate runs any Gradle task
- **THEN** it MUST invoke the resolved `gradlew` with `-p <workspace.workspaceDir>` and the task name
- **THEN** it MUST append passthrough arguments unchanged, after the task name
- **THEN** it MUST run the tool with inherited stdio

#### Scenario: `--output` не поддержан

- **WHEN** the invocation carries a non-null `output`
- **THEN** the delegate MUST return an unsupported result explaining that Android output location is configured
  in the module's build.gradle.kts, not via `--output`
- **THEN** it MUST NOT start any process

#### Scenario: Результат инструмента

- **WHEN** the Gradle task exits with code `0`
- **THEN** the delegate MUST report completion naming the workspace directory it worked from
- **WHEN** the Gradle task exits with a non-zero code
- **THEN** the delegate MUST report failure carrying that exit code
- **WHEN** `gradlew` cannot be started
- **THEN** the delegate MUST report a missing toolchain instead of a failure

## REMOVED Requirements

### Requirement: Android API meta capability

**Reason**: The API meta is no longer extracted by a platform tool: `dsbuilder components import-api` reads the meta from a file given with `--from`, so the `API_META` capability and the Gradle tasks `readUikitComposeApiMeta` and `readUikitApiMeta` are not used by the CLI.

**Migration**: Pass the meta file to `dsbuilder components import-api --from <file> --platform <platform>`.

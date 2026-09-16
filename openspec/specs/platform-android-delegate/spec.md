# platform-android-delegate Specification

## Purpose
TBD - created by archiving change platform-android-delegate. Update Purpose after archive.
## Requirements
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

### Requirement: Android tool discovery

The Android delegate SHALL locate `gradlew` by ascending from the workspace directory, and SHALL run it against
that workspace directory without computing a Gradle project path.

#### Scenario: Порядок поиска

- **WHEN** the delegate needs the tool and `--tool` is not given
- **THEN** it MUST search for `gradlew` starting at `workspace.workspaceDir` and ascending through parent
  directories until it finds one or reaches the file system root
- **THEN** it MUST invoke the found `gradlew` with `-p <workspace.workspaceDir>` rather than a computed
  `:project:path`

#### Scenario: Явный путь используется как есть

- **WHEN** the command provides `--tool <path>`
- **THEN** the delegate MUST use that path as the `gradlew` executable instead of searching
- **THEN** it MUST NOT fall back to searching when that path does not exist

#### Scenario: `gradlew` не найден

- **WHEN** no `gradlew` is found ascending from `workspace.workspaceDir` to the file system root
- **THEN** the delegate MUST report a missing toolchain naming the starting directory and `--tool`

### Requirement: Android toolchain doctor

The Android delegate SHALL report toolchain readiness by checking that the workspace's Gradle build recognizes
its theme generation task, without generating anything and without relying on a tool version.

#### Scenario: Инструмент готов

- **WHEN** `toolchain doctor` runs and `<gradlew> -p <workspace.workspaceDir> help --task generateComposeTheme`
  or `help --task generateViewTheme` exits with code `0` for at least one of them
- **THEN** the delegate MUST report a ready toolchain with the resolved `gradlew` path
- **THEN** it MUST NOT report a version string, since the Android tool has none of its own

#### Scenario: Инструмент непригоден

- **WHEN** `gradlew` is absent, cannot be started, or both `help --task` checks exit non-zero
- **THEN** the delegate MUST report a missing toolchain with a reason naming the checked module directory
- **THEN** `toolchain doctor` MUST exit with a non-zero code

#### Scenario: Doctor не гарантирует успешный run

- **WHEN** `doctor` reports a ready toolchain
- **THEN** a subsequent `run` MAY still fail if the specific requested capability/platform task is not
  configured for the module or the tool's own generation fails

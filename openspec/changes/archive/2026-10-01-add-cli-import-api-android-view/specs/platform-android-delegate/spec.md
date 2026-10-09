## MODIFIED Requirements

### Requirement: Android API meta capability

The `android` toolchain SHALL support the `API_META` capability for the `compose` and `android-view` target platforms by invoking the Gradle task of the `dsBuilder` plugin that extracts the API meta file from the uikit artifact on the project classpath: `readUikitComposeApiMeta` for `compose` and `readUikitApiMeta` for `android-view`.

#### Scenario: API meta для compose

- **WHEN** the delegate runs the `API_META` capability for `compose`
- **THEN** it MUST invoke the Gradle task `readUikitComposeApiMeta` with `-p <workspace.workspaceDir>`
- **THEN** it MUST append passthrough arguments unchanged, after the task name

#### Scenario: API meta для android-view

- **WHEN** the delegate runs the `API_META` capability for `android-view`
- **THEN** it MUST invoke the Gradle task `readUikitApiMeta` with `-p <workspace.workspaceDir>`
- **THEN** it MUST append passthrough arguments unchanged, after the task name
- **THEN** it MUST NOT return an unsupported result

#### Scenario: Результат по соглашению плагина

- **WHEN** the task exits with code `0`
- **THEN** the delegate MUST report completion
- **THEN** the meta file MUST be located inside the workspace directory at `build/theme-builder/components/uikit-compose-api-meta.json` for `compose` and `build/theme-builder/components/uikit-api-meta.json` for `android-view`

#### Scenario: `--output` не поддержан

- **WHEN** the invocation carries a non-null `output`
- **THEN** the delegate MUST return an unsupported result and MUST NOT start any process

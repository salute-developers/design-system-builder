## MODIFIED Requirements

### Requirement: Platform delegate contract

CLI SHALL expose a `PlatformDelegate` port that declares a toolchain id, the set of target platforms it serves, the set of capabilities it supports, a `doctor` check, and a `run` operation.

#### Scenario: Делегат объявляет платформы и capability

- **WHEN** a delegate is registered
- **THEN** it MUST declare a non-blank lowercase toolchain id matching `[a-z][a-z0-9-]*`
- **THEN** it MUST declare the target platforms it serves
- **THEN** it MUST declare which of `THEME`, `COMPONENTS`, `DOCS_AGGREGATE` it supports

#### Scenario: Вызов делегата

- **WHEN** CLI runs a delegate
- **THEN** it MUST pass the capability, the target platform, the workspace paths, an optional absolute output directory, an optional absolute tool override, and passthrough arguments unchanged
- **THEN** the delegate MUST return one of `Completed`, `Failed` with the tool exit code, `ToolchainMissing` with a hint, or `Unsupported`
- **THEN** the delegate MUST NOT receive or forward the project API key

#### Scenario: Проверка toolchain'а

- **WHEN** CLI asks a delegate for `doctor`
- **THEN** the delegate MUST return `Ready` with the executable path and version, `Missing` with a hint, or `Incompatible` with found and required versions
- **THEN** `doctor` MUST NOT generate anything

#### Scenario: Doctor проверяет инструмент из `--tool`

- **WHEN** a command is given `--tool <path>`
- **THEN** CLI MUST pass that path to `doctor`
- **THEN** the delegate MUST check that tool instead of the ones found by toolchain discovery

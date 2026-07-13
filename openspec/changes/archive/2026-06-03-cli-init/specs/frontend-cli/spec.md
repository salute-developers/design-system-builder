## ADDED Requirements

### Requirement: CLI module structure
`dsbuilder-frontend` SHALL contain a Kotlin Multiplatform module `:cli` for the `dsbuilder` CLI application, and SHALL NOT include `:desktopApp` or `:shared` in the active frontend Gradle build for this change.

#### Scenario: Frontend settings include only CLI module
- **WHEN** a developer opens `dsbuilder-frontend/settings.gradle.kts`
- **THEN** the active module list includes `:cli`
- **THEN** the active module list does not include `:desktopApp` or `:shared`

#### Scenario: CLI module uses common source sets
- **WHEN** a developer inspects `dsbuilder-frontend/cli`
- **THEN** the module contains Kotlin Multiplatform source sets for shared CLI behavior and tests
- **THEN** platform-specific process entrypoint code is isolated from shared CLI behavior

### Requirement: CLI application entrypoint
The `:cli` module SHALL provide an executable JVM entrypoint for a command named `dsbuilder`.

#### Scenario: CLI entrypoint is configured
- **WHEN** Gradle configures the `:cli` module
- **THEN** the module exposes a JVM main class for launching the CLI application
- **THEN** the configured application name is `dsbuilder`

#### Scenario: CLI can print baseline output
- **WHEN** a developer runs the CLI without product-specific command implementation
- **THEN** the CLI returns deterministic baseline output suitable for smoke testing
- **THEN** the CLI does not require backend services, Docker, credentials, or private URLs

### Requirement: CLI verification
The CLI module SHALL include tests for baseline CLI behavior and SHALL be verifiable through Gradle build, test, Detekt, and Spotless tasks in `dsbuilder-frontend`.

#### Scenario: CLI tests cover baseline behavior
- **WHEN** `./gradlew test` runs inside `dsbuilder-frontend`
- **THEN** tests for baseline CLI behavior execute successfully

#### Scenario: Frontend quality tasks are available
- **WHEN** a developer runs `./gradlew build`, `./gradlew detekt`, or `./gradlew spotlessCheck` inside `dsbuilder-frontend`
- **THEN** Gradle can resolve and execute the relevant checks for the `:cli` module

# kotlin-multiplatform-conventions Specification

## Purpose
Определяет общий Gradle convention plugin для Kotlin Multiplatform модулей, чтобы CLI и будущие frontend/shared модули использовали единый baseline сборки, Detekt и Spotless.

## Requirements

### Requirement: Kotlin Multiplatform convention plugin
`build-system` SHALL provide a reusable Gradle convention plugin for Kotlin Multiplatform modules.

#### Scenario: Convention plugin is available by id
- **WHEN** a module build script applies `convention.kotlin-multiplatform-module`
- **THEN** Gradle resolves the convention plugin from `build-system/conventions`
- **THEN** the module receives Kotlin Multiplatform configuration from the shared build-system

#### Scenario: Convention plugin configures shared quality tooling
- **WHEN** the convention plugin is applied to a module
- **THEN** Detekt configuration is available for that module
- **THEN** Spotless configuration is available for that module

### Requirement: Multiplatform baseline configuration
The Kotlin Multiplatform convention SHALL configure a baseline suitable for CLI and future frontend/shared modules without adding Ktor, Exposed, Docker, Compose Desktop, or external SDK dependencies.

#### Scenario: Convention keeps module dependencies minimal
- **WHEN** the convention plugin configures a Kotlin Multiplatform module
- **THEN** the module receives Kotlin standard library and test baseline dependencies only where needed
- **THEN** the module does not receive backend service dependencies such as Ktor server, Exposed, PostgreSQL JDBC, Koin Ktor, or Docker-related configuration

#### Scenario: Convention supports JVM target
- **WHEN** the convention plugin configures a Kotlin Multiplatform module
- **THEN** a JVM target is available for CLI execution and tests

### Requirement: Build-system verification
The new Kotlin Multiplatform convention SHALL be verified by the build-system Gradle build before the CLI change is considered ready.

#### Scenario: Build-system compiles convention plugin
- **WHEN** a developer runs `cd build-system && ./gradlew build`
- **THEN** the Kotlin Multiplatform convention plugin compiles successfully
- **THEN** Gradle plugin descriptors are generated for the new convention plugin

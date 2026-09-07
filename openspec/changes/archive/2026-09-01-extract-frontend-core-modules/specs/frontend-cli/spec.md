## MODIFIED Requirements

### Requirement: CLI module structure
`frontend-kt` SHALL contain a Kotlin Multiplatform module `:cli` for the `dsbuilder` CLI application, together with the Kotlin Multiplatform library modules `core-domain`, `core-network`, `core-auth`, `core-workspace`, `core-application`, `feature-theme`, `feature-docs`, `feature-components`, `feature-init`, and `feature-status` that hold the shared client business logic. `frontend-kt` SHALL NOT include `:desktopApp` or `:shared` in the active frontend Gradle build for this change.

#### Scenario: Frontend settings include the CLI module and the core/feature library modules
- **WHEN** a developer opens `frontend-kt/settings.gradle.kts`
- **THEN** the active module list includes `:cli`, `:core-domain`, `:core-network`, `:core-auth`, `:core-workspace`, `:core-application`, `:feature-theme`, `:feature-docs`, `:feature-components`, `:feature-init`, and `:feature-status`
- **THEN** the active module list does not include `:desktopApp` or `:shared`

#### Scenario: CLI module contains only presentation and the composition root
- **WHEN** a developer inspects `frontend-kt/cli`
- **THEN** the module contains only `*CliCommand` presentation classes, CLI-specific Koin presentation wiring, and the platform composition root (runtime wiring for JVM and macOS targets)
- **THEN** the module does not contain use case, domain, or data-adapter source code for any CLI feature
- **THEN** platform-specific process entrypoint code remains isolated from presentation source sets

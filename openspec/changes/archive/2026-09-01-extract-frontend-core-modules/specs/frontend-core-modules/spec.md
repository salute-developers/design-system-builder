## ADDED Requirements

### Requirement: Core layer module composition
`frontend-kt` SHALL provide the Kotlin Multiplatform library modules `core-domain`, `core-network`, `core-auth`, and `core-workspace`, each holding one layer of the shared client business logic that was previously private to `:cli`.

#### Scenario: core-domain holds shared domain models
- **WHEN** a developer inspects `core-domain`
- **THEN** the module contains `ProjectContext`, `ProjectApiKey`, `ProjectApiUrl`, `ProjectId`, `DesignSystemId`, `CredentialEnvName`, `ProjectAccessCheck`, and `ProjectConfigDraft`
- **THEN** the module does not depend on `core-network`, `core-auth`, `core-workspace`, `core-application`, or any `feature-*` module

#### Scenario: core-auth and core-workspace have no dependency on other core-* modules
- **WHEN** a developer inspects the Gradle module dependencies of `core-auth` and `core-workspace`
- **THEN** neither module depends on `core-domain`, on each other, or on `core-network`, `core-application`, or any `feature-*` module

#### Scenario: core-network depends only on core-auth
- **WHEN** a developer inspects the Gradle module dependencies of `core-network`
- **THEN** the module depends on `core-auth` (for the shared `EnvironmentReader` port that both API-key and API-URL resolution use)
- **THEN** the module does not depend on `core-domain`, `core-workspace`, `core-application`, or any `feature-*` module

### Requirement: Application layer module composition
`frontend-kt` SHALL provide a Kotlin Multiplatform library module `core-application` that holds the context/credential/API-URL resolution ports and their runtime adapters, depending on `core-domain`, `core-network`, `core-auth`, and `core-workspace`.

#### Scenario: core-application depends on all three core layers
- **WHEN** a developer inspects the Gradle module dependencies of `core-application`
- **THEN** the module depends on `core-domain`, `core-network`, `core-auth`, and `core-workspace`
- **THEN** the module does not depend on any `feature-*` module

### Requirement: Feature module composition
`frontend-kt` SHALL provide a separate Kotlin Multiplatform library module for each `dsbuilder` CLI feature — `feature-theme`, `feature-docs`, `feature-components`, `feature-init`, and `feature-status` — each holding that feature's domain, application, and data code.

#### Scenario: A feature module depends only on the core modules it uses
- **WHEN** a developer inspects the Gradle module dependencies of `feature-init`
- **THEN** the module depends on `core-domain` and `core-workspace`
- **THEN** the module does not depend on `core-network`, `core-auth`, or `core-application`

#### Scenario: A feature module does not depend on another feature module
- **WHEN** a developer inspects the Gradle module dependencies of any `feature-*` module
- **THEN** the module does not depend on any other `feature-*` module

### Requirement: Dependency direction between modules
The module graph SHALL enforce that dependencies flow only inward: `core-*` modules SHALL NOT depend on `feature-*` modules, `feature-*` modules SHALL NOT depend on each other, and client modules (`:cli`, and future MCP/desktop/IDE-plugin modules) SHALL depend on `feature-*` and `core-application` modules without any `feature-*` or `core-*` module depending back on a client module.

#### Scenario: No core-* module depends on a feature-* module
- **WHEN** a developer inspects the Gradle module dependencies of any `core-*` module
- **THEN** none of them declares a dependency on any `feature-*` module

#### Scenario: No feature-* or core-* module depends on :cli
- **WHEN** a developer inspects the Gradle module dependencies of any `core-*` or `feature-*` module
- **THEN** none of them declares a dependency on `:cli`

#### Scenario: A client module's composition root may depend directly on core-network, core-auth, or core-workspace
- **WHEN** a developer inspects `:cli`'s Gradle module dependencies
- **THEN** `:cli` depends on `core-application` and every `feature-*` module
- **THEN** `:cli` MAY additionally depend directly on `core-network`, `core-auth`, and `core-workspace` where its own composition root provides the platform-specific implementation of a port from that module (for example a JVM/macOS `WorkspaceFileSystem`, `EnvironmentReader`, or HTTP client factory)
- **THEN** `:cli` does not depend on `core-domain` directly, since none of its own source references a `core-domain` type outside what it already receives transitively

### Requirement: Visibility boundary at module edges
Kotlin type visibility inside each `core-*` and `feature-*` module SHALL follow the rule that only types actually consumed across a module boundary are `public`; every other type SHALL remain `internal` to its own module.

#### Scenario: Use case entrypoints are public
- **WHEN** a developer inspects a use case class consumed by `:cli` presentation (for example `FetchThemesUseCase` or `DocsPublishUseCase`) together with its `*Command`/`*Result` models
- **THEN** the use case class and its `*Command`/`*Result` models are declared `public`

#### Scenario: Internal ports and adapters stay internal to their feature module
- **WHEN** a developer inspects a port or adapter that is not directly imported by `:cli` presentation (for example `DocsCodec`, `ThemeWritePlanBuilder`, or `ComponentPackageLoader`)
- **THEN** the type remains declared `internal` within its `feature-*` module

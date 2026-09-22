## MODIFIED Requirements

### Requirement: Kotlin Multiplatform convention plugin

`build-system` SHALL предоставлять baseline KMP convention и отдельный reusable Node-library convention для shared
frontend modules, потребляемых Node.js MCP launcher.

#### Scenario: Convention plugin is available by id

- **WHEN** a module build script applies `convention.kotlin-multiplatform-module`
- **THEN** Gradle resolves the convention plugin from `build-system/conventions`
- **THEN** the module receives Kotlin Multiplatform configuration from the shared build-system

#### Scenario: Convention plugin configures shared quality tooling

- **WHEN** the convention plugin is applied to a module
- **THEN** Detekt configuration is available for that module
- **THEN** Spotless configuration is available for that module

#### Scenario: Node-library convention доступен по стабильному id

- **WHEN** shared-модуль применяет Node-library convention
- **THEN** Gradle MUST настроить JVM, macOS arm64/x64 и Node.js JS targets
- **THEN** convention MUST подключить общие quality/test baselines

#### Scenario: CLI не получает JS target неявно

- **WHEN** `:cli` применяет application-oriented KMP convention
- **THEN** Node.js JS target MUST NOT добавляться только из-за появления `:mcp-node`
- **THEN** JVM/macOS CLI packaging MUST остаться доступным

### Requirement: Multiplatform baseline configuration

Shared Node-compatible convention SHALL добавлять только target/tooling baseline и SHALL NOT навязывать MCP SDK, Ktor
engine или npm application packaging всем KMP-модулям.

#### Scenario: Convention keeps module dependencies minimal

- **WHEN** the convention plugin configures a Kotlin Multiplatform module
- **THEN** the module receives Kotlin standard library and test baseline dependencies only where needed
- **THEN** the module does not receive backend service dependencies such as Ktor server, Exposed, PostgreSQL JDBC, Koin Ktor, or Docker-related configuration

#### Scenario: Convention supports JVM target

- **WHEN** the convention plugin configures a Kotlin Multiplatform module
- **THEN** a JVM target is available for CLI execution and tests

#### Scenario: MCP dependency остается module-specific

- **WHEN** Node-library convention применяется к `core-*` или `feature-*`
- **THEN** `kotlin-sdk-server` MUST NOT появляться транзитивно из convention
- **THEN** MCP SDK dependency MUST объявляться только в `:mcp-server-core`

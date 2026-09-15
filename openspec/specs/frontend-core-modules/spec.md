# frontend-core-modules Specification

## Purpose
Определяет модульную структуру shared client business logic в `frontend-kt`: слои `core-domain`, `core-network`, `core-auth`, `core-workspace`, `core-application` и feature-модули (`feature-theme`, `feature-docs`, `feature-components`, `feature-init`, `feature-status`), а также правила зависимостей и видимости между ними.
## Requirements
### Requirement: Core layer module composition

`core-auth`, `core-network`, `core-workspace` и `core-domain` SHALL оставаться shared KMP layers, поддерживающими JVM,
macOS и Node.js JS для общего CLI/MCP runtime.

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

#### Scenario: core-auth определяет credential contracts

- **WHEN** разработчик инспектирует `core-auth`
- **THEN** модуль MUST содержать shared модели/порты project key и user session credentials
- **THEN** модуль MUST NOT зависеть от MCP SDK, CLI presentation или конкретного Node/JVM filesystem API

#### Scenario: core-network поддерживает оба authorization header

- **WHEN** разработчик инспектирует `core-network`
- **THEN** authenticated HTTP boundary MUST поддерживать `ProjectKey` и `Bearer` credentials
- **THEN** HTTP operations MUST быть suspend и MUST NOT использовать `runBlocking`

### Requirement: Application layer module composition

`core-application` SHALL координировать общий `ContextResolver`, `ApiUrlResolver`, `CredentialProvider`, token lifecycle и
runtime ports для CLI/MCP без зависимости от presentation modules.

#### Scenario: core-application depends on all three core layers

- **WHEN** a developer inspects the Gradle module dependencies of `core-application`
- **THEN** the module depends on `core-domain`, `core-network`, `core-auth`, and `core-workspace`
- **THEN** the module does not depend on any `feature-*` module

#### Scenario: CLI и MCP используют одни resolver

- **WHEN** composition root собирает CLI или MCP runtime
- **THEN** оба consumer MUST получать одни реализации `ContextResolver`, `ApiUrlResolver` и `CredentialProvider`
- **THEN** `core-application` MUST NOT зависеть от `:cli`, `:mcp-server-core` или `:mcp-node`

### Requirement: Feature module composition

`frontend-kt` SHALL предоставлять отдельный `feature-auth` рядом с существующими feature-модулями; feature-модули SHALL
оставаться независимыми друг от друга.

#### Scenario: A feature module depends only on the core modules it uses

- **WHEN** a developer inspects the Gradle module dependencies of `feature-init`
- **THEN** the module depends on `core-domain` and `core-workspace`
- **THEN** the module does not depend on `core-network`, `core-auth`, or `core-application`

#### Scenario: A feature module does not depend on another feature module

- **WHEN** a developer inspects the Gradle module dependencies of any `feature-*` module
- **THEN** the module does not depend on any other `feature-*` module

#### Scenario: feature-auth содержит пользовательские auth use cases

- **WHEN** разработчик инспектирует `feature-auth`
- **THEN** модуль MUST содержать `LoginUseCase`, `AuthStatusUseCase`, `LogoutUseCase` и их application/data/di wiring
- **THEN** модуль MUST NOT содержать CLI/MCP-specific presentation
- **THEN** модуль MUST NOT зависеть от другого `feature-*` модуля

### Requirement: Dependency direction between modules

`:cli` и `:mcp-node` SHALL быть независимыми client composition roots над общими `core-*`, `feature-*` и
`:mcp-server-core`; ни один shared-модуль SHALL NOT зависеть обратно от launcher.

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

#### Scenario: Launcher не зависят друг от друга

- **WHEN** разработчик инспектирует Gradle dependencies `:cli` и `:mcp-node`
- **THEN** `:cli` MUST NOT зависеть от `:mcp-node`
- **THEN** `:mcp-node` MUST NOT зависеть от `:cli`
- **THEN** оба MAY зависеть от `:mcp-server-core`, `feature-auth` и требуемых shared modules

### Requirement: Visibility boundary at module edges
Kotlin type visibility inside each `core-*` and `feature-*` module SHALL follow the rule that only types actually consumed across a module boundary are `public`; every other type SHALL remain `internal` to its own module.

#### Scenario: Use case entrypoints are public
- **WHEN** a developer inspects a use case class consumed by `:cli` presentation (for example `FetchThemesUseCase` or `DocsPublishUseCase`) together with its `*Command`/`*Result` models
- **THEN** the use case class and its `*Command`/`*Result` models are declared `public`

#### Scenario: Internal ports and adapters stay internal to their feature module
- **WHEN** a developer inspects a port or adapter that is not directly imported by `:cli` presentation (for example `DocsCodec`, `ThemeWritePlanBuilder`, or `ComponentPackageLoader`)
- **THEN** the type remains declared `internal` within its `feature-*` module

### Requirement: Interactive user OAuth session support

`core-auth` SHALL предоставлять resolver пользовательской OAuth-сессии (access token в памяти, ссылка на refresh token в защищённом хранилище) как второй, параллельный источник учётных данных наравне с существующим `ApiKeyResolver`. `core-network` SHALL поддерживать авторизацию `Authorization: Bearer <jwt>` в дополнение к существующей `Authorization: ProjectKey <key>`.

#### Scenario: core-auth предоставляет resolver пользовательской сессии

- **WHEN** клиентский модуль (например `:plugins:android-studio`) запрашивает у `core-auth` текущие учётные данные пользователя
- **THEN** `core-auth` предоставляет тип, отдельный от `ApiKeyResolver`, который отдаёт access token из памяти и не хранит его в открытом виде на диске

#### Scenario: core-network поддерживает Bearer-авторизацию

- **WHEN** HTTP-клиент `core-network` формирует запрос с пользовательской OAuth-сессией в качестве источника credential
- **THEN** клиент MUST устанавливать заголовок `Authorization: Bearer <access-token>` вместо `Authorization: ProjectKey <key>`

#### Scenario: Существующий project-key флоу не меняется

- **WHEN** клиентский модуль продолжает использовать `ApiKeyResolver` (например `:cli`)
- **THEN** поведение `core-network` для `ProjectKey`-авторизации остаётся прежним

#### Scenario: core-auth не зависит от других core-* модулей

- **WHEN** разработчик инспектирует Gradle-зависимости `core-auth` после добавления resolver'а пользовательской сессии
- **THEN** `core-auth` по-прежнему не зависит от `core-domain`, `core-network`, `core-workspace`, `core-application` или любого `feature-*` модуля

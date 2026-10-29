## MODIFIED Requirements

### Requirement: Feature module composition

`frontend-kt` SHALL предоставлять отдельные `feature-auth` и `feature-projects` рядом с существующими feature-модулями; feature-модули SHALL оставаться независимыми друг от друга.

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

#### Scenario: feature-auth содержит OAuth Authorization Code + PKCE use case

- **WHEN** разработчик инспектирует `feature-auth`
- **THEN** модуль MUST содержать `commonMain` порты `BrowserLauncher` (открыть URL в системном браузере) и `RedirectListener` (дождаться OAuth redirect на loopback-адресе) — они не зависят от платформенного API и не требуют `jvmMain`
- **THEN** модуль MUST содержать `jvmMain` use case-оркестратор Authorization Code + PKCE флоу (build authorize URL, дождаться redirect, обменять код на токены, применить сессию) и юзкейс тихого refresh по `401`, а также `jvmMain` реализации портов `RedirectListener` — оркестратор живёт в `jvmMain`, так как использует уже существующий `core-auth`'s `PkceGenerator`, который сам JVM-only (единственный сегодняшний потребитель PKCE — JVM-клиенты)
- **THEN** модуль MUST NOT содержать IntelliJ Platform-специфичный адаптер `BrowserLauncher` (он остаётся в клиентском composition root, например `:plugins:android-studio`)

#### Scenario: feature-theme содержит tenant и code-ссылку токена для клиентов без ProjectContext

- **WHEN** разработчик инспектирует `feature-theme`
- **THEN** модуль MUST содержать `ListDesignSystemTenantsUseCase` (tenant по выбранным проекту и дизайн-системе от имени пользовательской сессии) и `GetTokenCodeReferenceUseCase` (`themeReference` токена из CodeBinding последней публикации, по `subject`)
- **THEN** порты `DesignSystemTenantsClient`/`TokenCodeReferenceClient` и адаптеры `HttpDesignSystemTenantsClient`/`HttpTokenCodeReferenceClient` MUST быть `public` — non-Koin клиент (`:plugins:android-studio`) конструирует use case напрямую

#### Scenario: feature-projects содержит use case списка проектов

- **WHEN** разработчик инспектирует `feature-projects`
- **THEN** модуль MUST содержать `ListProjectsUseCase` и его application/data/di wiring поверх `core-network`
- **THEN** порт `ProjectsClient` и его HTTP-адаптер `HttpProjectsClient` MUST быть `public` (не `internal`, в отличие от аналогичных портов `feature-status`/`feature-theme`) — единственный сегодняшний потребитель, `:plugins:android-studio`, не использует Koin и конструирует `ListProjectsUseCase` напрямую, минуя DI-граф
- **THEN** модуль MUST NOT зависеть от `core-application` или `core-workspace`
- **THEN** модуль MUST NOT зависеть от другого `feature-*` модуля

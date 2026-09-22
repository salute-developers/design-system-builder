## MODIFIED Requirements

### Requirement: CLI module structure

`frontend-kt` SHALL содержать Kotlin Multiplatform приложение `:cli`, общие `core-*`/`feature-*` библиотеки, новый
`feature-auth` и MCP-модули `mcp-server-core`/`mcp-node`. `:cli` SHALL оставаться presentation/composition root и SHALL
запускать общий MCP server in-process.

#### Scenario: Frontend settings include the CLI module and the core/feature library modules

- **WHEN** a developer opens `frontend-kt/settings.gradle.kts`
- **THEN** the active module list includes `:cli`, `:core-domain`, `:core-network`, `:core-auth`, `:core-workspace`, `:core-application`, `:feature-theme`, `:feature-docs`, `:feature-components`, `:feature-init`, and `:feature-status`
- **THEN** the active module list does not include `:desktopApp` or `:shared`

#### Scenario: CLI module contains only presentation and the composition root

- **WHEN** a developer inspects `frontend-kt/cli`
- **THEN** the module contains only `*CliCommand` presentation classes, CLI-specific Koin presentation wiring, and the platform composition root (runtime wiring for JVM and macOS targets)
- **THEN** the module does not contain use case, domain, or data-adapter source code for any CLI feature
- **THEN** platform-specific process entrypoint code remains isolated from presentation source sets

#### Scenario: Frontend settings включают auth и MCP модули

- **WHEN** разработчик открывает `frontend-kt/settings.gradle.kts`
- **THEN** active module list MUST включать `:feature-auth`, `:mcp-server-core` и `:mcp-node` вместе с существующими
  `:cli`, `core-*` и `feature-*`

#### Scenario: CLI остается тонким presentation-слоем

- **WHEN** разработчик инспектирует `frontend-kt/cli`
- **THEN** модуль MUST содержать только CLI presentation, DI/composition root и platform launcher adapters
- **THEN** login/refresh/session и MCP tool business logic MUST находиться в общих модулях

### Requirement: CLI command parsing

`dsbuilder` CLI SHALL предоставлять существующие product commands, пользовательские `auth` subcommands и локальный
`mcp serve` launcher через Kotlin Multiplatform command parser.

#### Scenario: Root command exposes subcommands

- **WHEN** developer runs `dsbuilder --help`
- **THEN** CLI MUST show deterministic help for the root `dsbuilder` command
- **THEN** help MUST include `init`, `status`, `theme`, and `components` subcommands

#### Scenario: Theme command exposes subcommands

- **WHEN** developer runs `dsbuilder theme --help`
- **THEN** CLI MUST show deterministic help for the `theme` command
- **THEN** help MUST include `fetch` subcommand
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Components command exposes subcommands

- **WHEN** developer runs `dsbuilder components --help`
- **THEN** CLI MUST show deterministic help for the `components` command
- **THEN** help MUST include `push` and `fetch` subcommands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Required option is missing

- **WHEN** developer runs `dsbuilder init` without required options
- **THEN** CLI MUST return a deterministic option error
- **THEN** CLI MUST NOT create `.sdds/config.json`

#### Scenario: Unknown command is rejected

- **WHEN** developer runs `dsbuilder unknown-command`
- **THEN** CLI MUST return a deterministic unknown command error
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Root command показывает новые группы

- **WHEN** пользователь запускает `dsbuilder --help`
- **THEN** help MUST включать `auth` и `mcp` вместе с существующими subcommands
- **THEN** help MUST NOT требовать `.sdds`, backend или credentials

#### Scenario: MCP command показывает serve

- **WHEN** пользователь запускает `dsbuilder mcp --help`
- **THEN** help MUST включать `serve`
- **THEN** help MUST описывать `--api-url` и `--workspace` без запуска MCP server

#### Scenario: Auth command показывает lifecycle commands

- **WHEN** пользователь запускает `dsbuilder auth --help`
- **THEN** help MUST включать `login`, `status` и `logout`
- **THEN** help MUST NOT читать password или обращаться к backend

### Requirement: CLI project-scoped command foundation

Project-scoped CLI commands SHALL использовать общие context, API URL и credential services с приоритетом project key,
затем user session, не меняя actor после backend authorization failure.

#### Scenario: Project command использует CLI core

- **WHEN** a future project-scoped command is added to `dsbuilder`
- **THEN** it MUST use CLI core to resolve `.sdds/config.json`
- **THEN** it MUST use CLI core to resolve API key credentials
- **THEN** it MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests

#### Scenario: Theme fetch использует CLI core

- **WHEN** developer runs `dsbuilder theme fetch`
- **THEN** CLI MUST resolve the nearest `.sdds/config.json` through CLI core
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests

#### Scenario: Components push использует CLI core

- **WHEN** developer runs `dsbuilder components push`
- **THEN** CLI MUST resolve the nearest `.sdds/config.json` through CLI core
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests
- **THEN** CLI MUST use CLI core to reject the code default backend API URL

#### Scenario: Components fetch использует CLI core

- **WHEN** developer runs `dsbuilder components fetch`
- **THEN** CLI MUST resolve the nearest `.sdds/config.json` through CLI core
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests

#### Scenario: Baseline commands остаются доступными

- **WHEN** developer runs `dsbuilder --help` or `dsbuilder --version`
- **THEN** CLI MUST continue returning deterministic baseline output
- **THEN** these baseline commands MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Project key отсутствует, но user session доступна

- **WHEN** CLI command разрешает project context, но project key отсутствует
- **WHEN** для resolved API URL доступна user session
- **THEN** command MUST выполнить backend request с пользовательским Bearer access token

#### Scenario: Project key найден, но отклонен

- **WHEN** CLI command использует найденный project key и получает `401` или `403`
- **THEN** command MUST вернуть deterministic project-key/forbidden error
- **THEN** command MUST NOT повторять запрос через user session

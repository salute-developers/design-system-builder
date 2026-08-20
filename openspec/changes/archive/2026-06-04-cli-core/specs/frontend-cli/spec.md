## ADDED Requirements

### Requirement: CLI command parsing

The `dsbuilder` CLI SHALL use a Kotlin Multiplatform command parser for root command behavior, subcommands, options, help output, and option errors.

#### Scenario: Root command exposes subcommands

- **WHEN** developer runs `dsbuilder --help`
- **THEN** CLI MUST show deterministic help for the root `dsbuilder` command
- **THEN** help MUST include `init` and `status` subcommands

#### Scenario: Required option is missing

- **WHEN** developer runs `dsbuilder init` without required options
- **THEN** CLI MUST return a deterministic option error
- **THEN** CLI MUST NOT create `.sdds/config.json`

#### Scenario: Unknown command is rejected

- **WHEN** developer runs `dsbuilder unknown-command`
- **THEN** CLI MUST return a deterministic unknown command error
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

### Requirement: CLI init command

The `dsbuilder` CLI SHALL provide an `init` command that creates local project configuration for the current directory.

#### Scenario: Init создает project config

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a`
- **THEN** CLI MUST create `.sdds/config.json` in the target directory
- **THEN** generated config MUST contain JSON field `"projectId": "project-a"`
- **THEN** generated config MUST contain JSON field `"designSystemId": "design-system-a"`
- **THEN** generated config MUST contain env credential reference `DSBUILDER_API_KEY`

#### Scenario: Init принимает custom API key env

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a --api-key-env DSBUILDER_PROJECT_A_API_KEY`
- **THEN** generated config MUST contain env credential reference `DSBUILDER_PROJECT_A_API_KEY`

#### Scenario: Init не принимает raw API key

- **WHEN** developer runs `dsbuilder init`
- **THEN** CLI MUST NOT require raw API key input
- **THEN** CLI MUST NOT write raw API key into `.sdds/config.json`
- **THEN** CLI MUST NOT write API URL into `.sdds/config.json`

#### Scenario: Init защищает существующий config

- **WHEN** `.sdds/config.json` already exists in the target directory
- **WHEN** developer runs `dsbuilder init` without an explicit overwrite option
- **THEN** CLI MUST return a deterministic error
- **THEN** CLI MUST NOT silently overwrite the existing config

### Requirement: CLI project-scoped command foundation

The `dsbuilder` CLI SHALL route project-scoped commands through shared CLI core config, credential, and HTTP behavior.

#### Scenario: Project command использует CLI core

- **WHEN** a future project-scoped command is added to `dsbuilder`
- **THEN** it MUST use CLI core to resolve `.sdds/config.json`
- **THEN** it MUST use CLI core to resolve API key credentials
- **THEN** it MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests

#### Scenario: Baseline commands остаются доступными

- **WHEN** developer runs `dsbuilder --help` or `dsbuilder --version`
- **THEN** CLI MUST continue returning deterministic baseline output
- **THEN** these baseline commands MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

### Requirement: CLI status command

The `dsbuilder` CLI SHALL provide a `status` command that verifies the configured project and design system without printing project lists or raw credentials.

#### Scenario: Status проверяет API key через configured project

- **WHEN** developer runs `dsbuilder status` inside an initialized project directory
- **THEN** CLI MUST resolve the nearest `.sdds/config.json`
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST resolve API URL through CLI core
- **THEN** CLI MUST send `GET /api/projects/{projectId}` using `projectId` from config
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}` using `projectId` and `designSystemId` from config
- **THEN** CLI MUST include `Authorization: ProjectKey <api_key>`

#### Scenario: Status показывает только результат проверки

- **WHEN** backend returns success for `dsbuilder status`
- **THEN** CLI MUST print a deterministic authorized status
- **THEN** CLI MUST print project `name` from project response
- **THEN** CLI MUST print design system `name` from design system response
- **THEN** CLI MUST NOT print the project list
- **THEN** CLI MUST NOT print the raw API key

#### Scenario: Status сообщает об ошибке авторизации

- **WHEN** backend returns `401`, `403`, or `404` for `dsbuilder status`
- **THEN** CLI MUST map the response through common CLI core HTTP error handling
- **THEN** CLI MUST print a deterministic failure message without raw API key values

#### Scenario: Status не использует user-scoped project list

- **WHEN** developer runs `dsbuilder status`
- **THEN** CLI MUST NOT call `GET /api/projects` for API key validation
- **THEN** CLI MUST validate only the project configured in `.sdds/config.json`

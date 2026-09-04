## MODIFIED Requirements

### Requirement: CLI command parsing

The `dsbuilder` CLI SHALL use a Kotlin Multiplatform command parser for root command behavior, subcommands, nested subcommands, options, help output, and option errors.

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
- **THEN** help MUST include `push` subcommand
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Required option is missing

- **WHEN** developer runs `dsbuilder init` without required options
- **THEN** CLI MUST return a deterministic option error
- **THEN** CLI MUST NOT create `.sdds/config.json`

#### Scenario: Unknown command is rejected

- **WHEN** developer runs `dsbuilder unknown-command`
- **THEN** CLI MUST return a deterministic unknown command error
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

### Requirement: CLI project-scoped command foundation

The `dsbuilder` CLI SHALL route project-scoped commands through shared CLI core config, credential, and HTTP behavior.

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

#### Scenario: Baseline commands остаются доступными

- **WHEN** developer runs `dsbuilder --help` or `dsbuilder --version`
- **THEN** CLI MUST continue returning deterministic baseline output
- **THEN** these baseline commands MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

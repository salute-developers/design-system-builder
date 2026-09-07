# frontend-cli Specification

## MODIFIED Requirements

### Requirement: CLI command parsing

The `dsbuilder` CLI SHALL use a Kotlin Multiplatform command parser for root command behavior, subcommands, nested subcommands, options, help output, and option errors.

#### Scenario: Root command exposes subcommands

- **WHEN** developer runs `dsbuilder --help`
- **THEN** CLI MUST show deterministic help for the root `dsbuilder` command
- **THEN** help MUST include `init`, `status`, `theme`, `components`, `docs`, and `toolchain` subcommands

#### Scenario: Theme command exposes subcommands

- **WHEN** developer runs `dsbuilder theme --help`
- **THEN** CLI MUST show deterministic help for the `theme` command
- **THEN** help MUST include `fetch` and `generate` subcommands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Components command exposes subcommands

- **WHEN** developer runs `dsbuilder components --help`
- **THEN** CLI MUST show deterministic help for the `components` command
- **THEN** help MUST include `push`, `fetch` and `generate` subcommands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Toolchain command exposes subcommands

- **WHEN** developer runs `dsbuilder toolchain --help`
- **THEN** CLI MUST show deterministic help for the `toolchain` command
- **THEN** help MUST include `list` and `doctor` subcommands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

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

#### Scenario: Init принимает целевые платформы

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a --platform swiftui`
- **THEN** generated config MUST contain JSON array field `platforms` with value `["swiftui"]`
- **WHEN** the option is repeated for several platforms
- **THEN** generated config MUST contain every listed platform in the order they were given

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

# cli-core Specification

## Purpose
Определяет общий CLI core для project-scoped команд `dsbuilder`: discovery локального project context, credential resolution, API URL resolution и authenticated HTTP foundation.
## Requirements
### Requirement: Local project config discovery

CLI core SHALL resolve project context by searching for the nearest `.sdds/config.json` from the current working directory upward.

#### Scenario: Config найден в текущей директории

- **WHEN** CLI command запускается из директории, содержащей `.sdds/config.json`
- **THEN** CLI MUST use that config as the project context
- **THEN** resolved context MUST include `projectId`, `designSystemId`, and credential env variable name

#### Scenario: Config найден в родительской директории

- **WHEN** CLI command запускается из вложенной директории внутри project tree
- **THEN** CLI MUST search parent directories until it finds the nearest `.sdds/config.json`
- **THEN** CLI MUST use the nearest matching config

#### Scenario: Config отсутствует

- **WHEN** CLI command требует project context и `.sdds/config.json` не найден в current directory или parent directories
- **THEN** CLI MUST return a deterministic error explaining that the project is not initialized
- **THEN** CLI MUST NOT attempt backend requests

### Requirement: Project config stores no raw secrets

CLI project config SHALL store only non-secret project metadata, local tenant aliases, local artifact paths, and credential references.

#### Scenario: Config содержит env credential reference

- **WHEN** `.sdds/config.json` is generated or parsed
- **THEN** it MUST support `projectId`
- **THEN** it MUST support `designSystemId`
- **THEN** it MUST support JSON object `credential` with `type = "env"` and `name`

#### Scenario: Config содержит optional tenants metadata

- **WHEN** `.sdds/config.json` is generated, parsed, or updated by `theme fetch`
- **THEN** it MUST support optional JSON array field `tenants`
- **THEN** each tenant entry MUST support fields `id`, `designSystemId`, `name`, `description`, `createdAt`, and `updatedAt`
- **THEN** each tenant entry MUST support optional fields `directoryPath` and `alias`
- **THEN** config without `tenants` MUST remain valid
- **THEN** config with tenants that do not define `alias` MUST remain valid

#### Scenario: Config содержит optional palette path

- **WHEN** `.sdds/config.json` is generated, parsed, or updated by `theme fetch`
- **THEN** it MUST support optional JSON string field `palettePath`
- **THEN** config without `palettePath` MUST remain valid
- **THEN** `palettePath` MUST be treated as non-secret local project metadata

#### Scenario: Raw API key не сохраняется

- **WHEN** CLI creates `.sdds/config.json`
- **THEN** generated config MUST NOT contain raw API key values
- **THEN** generated config MUST NOT contain API URL values
- **THEN** generated config MUST contain only the env variable name used to read the API key

#### Scenario: Theme fetch не сохраняет runtime secrets

- **WHEN** CLI updates `.sdds/config.json` after `theme fetch`
- **THEN** updated config MUST NOT contain raw API key values
- **THEN** updated config MUST NOT contain API URL values
- **THEN** updated config MUST preserve only the credential reference used to read the API key

#### Scenario: Theme fetch сохраняет palette path

- **WHEN** CLI updates `.sdds/config.json` after successful `theme fetch`
- **THEN** updated config MUST contain `palettePath = ".sdds/tenants/palette.json"`
- **THEN** updated config MUST preserve existing `projectId`, `designSystemId`, `credential`, and tenant alias metadata
- **THEN** updated config MUST NOT contain raw API key values
- **THEN** updated config MUST NOT contain API URL values

### Requirement: Local tenant alias metadata

CLI core SHALL treat `tenants[].alias` as local non-secret tenant metadata stored only in `.sdds/config.json`.

#### Scenario: Tenant alias читается из config

- **WHEN** `.sdds/config.json` contains tenant with JSON field `"alias": "main"`
- **THEN** CLI MUST parse the tenant alias as part of local project config
- **THEN** CLI MUST NOT require backend services, credentials, or private URLs only to parse the alias

#### Scenario: Tenant alias сериализуется в config

- **WHEN** CLI writes `.sdds/config.json` for a tenant with alias `main`
- **THEN** CLI MUST write JSON field `"alias": "main"` inside that tenant entry
- **THEN** CLI MUST NOT write raw API key values into `.sdds/config.json`
- **THEN** CLI MUST NOT write API URL values into `.sdds/config.json`

#### Scenario: Config без alias остается валидным

- **WHEN** `.sdds/config.json` contains tenants without `alias`
- **THEN** CLI MUST parse the config successfully
- **THEN** parsed tenants MUST have no local alias value

### Requirement: API key credential resolution

CLI core SHALL resolve project API key from runtime sources in a deterministic priority order.

#### Scenario: CLI argument имеет высший приоритет

- **WHEN** command receives `--api-key <value>`
- **THEN** CLI MUST use that value as the API key
- **THEN** CLI MUST NOT read env variables for the API key

#### Scenario: Project-specific env variable используется из config

- **WHEN** `--api-key` is absent
- **WHEN** `.sdds/config.json` defines JSON object `credential` with `type = "env"` and `name = "DSBUILDER_PROJECT_A_API_KEY"`
- **WHEN** environment contains `DSBUILDER_PROJECT_A_API_KEY`
- **THEN** CLI MUST use that env value as the API key

#### Scenario: Fallback env используется последним

- **WHEN** `--api-key` is absent
- **WHEN** project-specific env variable is absent
- **WHEN** environment contains `DSBUILDER_API_KEY`
- **THEN** CLI MUST use `DSBUILDER_API_KEY` as the API key

#### Scenario: API key отсутствует

- **WHEN** no supported runtime source contains an API key
- **THEN** CLI MUST return a deterministic credential error
- **THEN** the error MUST mention the configured env variable name when available
- **THEN** CLI MUST NOT attempt backend requests

### Requirement: API URL resolution

CLI core SHALL resolve backend API URL from runtime sources and code defaults without reading it from `.sdds/config.json`.

#### Scenario: CLI argument имеет высший приоритет

- **WHEN** command receives `--api-url <value>`
- **THEN** CLI MUST use that value as the backend API URL
- **THEN** CLI MUST NOT read env variables for the API URL

#### Scenario: Env API URL используется после CLI argument

- **WHEN** `--api-url` is absent
- **WHEN** environment contains `DSBUILDER_API_URL`
- **THEN** CLI MUST use `DSBUILDER_API_URL` as the backend API URL

#### Scenario: Default API URL используется последним

- **WHEN** `--api-url` is absent
- **WHEN** environment does not contain `DSBUILDER_API_URL`
- **THEN** CLI MUST use the default API URL defined in code

#### Scenario: Project config не задает API URL

- **WHEN** `.sdds/config.json` is generated or parsed
- **THEN** CLI MUST NOT require or persist `apiUrl` in project config

### Requirement: Authenticated HTTP request foundation

CLI core SHALL provide a reusable Ktor client based HTTP layer for future project-scoped commands.

#### Scenario: Project request получает Authorization header

- **WHEN** a future project-scoped command sends a backend request through CLI core HTTP layer
- **THEN** the request MUST use the resolved API URL as the base URL
- **THEN** the request MUST include `Authorization: ProjectKey <api_key>`

#### Scenario: Backend auth errors are mapped

- **WHEN** backend response status is `401`
- **THEN** CLI MUST map it to a user-facing invalid or missing API key error
- **WHEN** backend response status is `403`
- **THEN** CLI MUST map it to a user-facing project access or scope error
- **WHEN** backend response status is `404`
- **THEN** CLI MUST map it to a user-facing project or resource not found error

#### Scenario: CLI не валидирует API key локально

- **WHEN** CLI resolves an API key
- **THEN** CLI MUST NOT verify revoked status, expiration, scopes, or project binding locally
- **THEN** backend gateway/auth-helper/projects-service MUST remain the source of truth for API key authorization

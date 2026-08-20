## MODIFIED Requirements

### Requirement: API URL resolution

CLI core SHALL resolve backend API URL from runtime sources and code defaults without reading it from `.sdds/config.json`, and SHALL report which source produced the value so that writing commands can reject the code default.

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

#### Scenario: Resolution сообщает источник значения

- **WHEN** CLI core resolves the backend API URL
- **THEN** the result MUST expose which runtime source produced the value
- **THEN** the result MUST distinguish the code default from an explicitly provided value

### Requirement: Authenticated HTTP request foundation

CLI core SHALL provide a reusable Ktor client based HTTP layer for project-scoped commands, supporting both reading and writing requests.

#### Scenario: Project request получает Authorization header

- **WHEN** a project-scoped command sends a backend request through CLI core HTTP layer
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

#### Scenario: HTTP layer поддерживает запись

- **WHEN** a project-scoped command needs to send data to the backend
- **THEN** CLI core HTTP layer MUST provide a request with a JSON body
- **THEN** that request MUST use the resolved API URL as the base URL
- **THEN** that request MUST include `Authorization: ProjectKey <api_key>`
- **THEN** that request MUST map backend errors through the same error handling as reading requests

## ADDED Requirements

### Requirement: Writing commands reject the default API URL

CLI core SHALL provide a way for writing commands to require an explicitly provided backend API URL, because the code default points at a shared backend installation.

#### Scenario: Writing command отклоняет code default

- **WHEN** a writing command resolves the backend API URL
- **WHEN** the resolved source is the code default
- **THEN** CLI MUST return a deterministic failure output
- **THEN** the message MUST name both `--api-url` and `DSBUILDER_API_URL`
- **THEN** CLI MUST NOT send any backend request

#### Scenario: Reading command сохраняет прежнее поведение

- **WHEN** a reading command resolves the backend API URL
- **WHEN** the resolved source is the code default
- **THEN** CLI MUST use the code default
- **THEN** CLI MUST NOT fail only because the default was used

#### Scenario: Writing command печатает цель запроса

- **WHEN** a writing command is about to send data to the backend
- **THEN** CLI MUST print the resolved backend API URL and its source
- **THEN** CLI MUST NOT print the raw API key

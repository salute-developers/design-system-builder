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

CLI core SHALL разрешать project API key из runtime sources в детерминированном порядке только тогда, когда выбранная credential policy допускает project key; forced `user-session` SHALL обходить key sources. Для имени из `credential.name` и fallback имени `DSBUILDER_API_KEY` CLI core SHALL сначала проверять env процесса, затем `.env` найденного локального проекта. Приоритет имени из `credential.name` над fallback именем сохраняется.

#### Scenario: CLI argument имеет высший приоритет

- **WHEN** выбран key mode и команда получает `--api-key <value>`
- **THEN** CLI MUST использовать это значение как API key
- **THEN** CLI MUST NOT читать env-переменные для API key

#### Scenario: Project-specific env variable используется из config

- **WHEN** `--api-key` отсутствует
- **WHEN** `.sdds/config.json` содержит `credential.name = "DSBUILDER_PROJECT_A_API_KEY"` и policy допускает key
- **WHEN** env процесса или проектный `.env` содержит `DSBUILDER_PROJECT_A_API_KEY`
- **THEN** CLI MUST использовать значение этого имени как API key с приоритетом env процесса

#### Scenario: Fallback env используется последним

- **WHEN** `--api-key` и project-specific env отсутствуют в допускающем key mode
- **WHEN** env процесса или проектный `.env` содержит `DSBUILDER_API_KEY`
- **THEN** CLI MUST использовать `DSBUILDER_API_KEY` как API key с приоритетом env процесса

#### Scenario: API key отсутствует

- **WHEN** выбран forced key mode и ни один поддерживаемый runtime source не содержит API key
- **THEN** CLI MUST вернуть детерминированную credential error с именем configured env, если оно известно
- **THEN** CLI MUST NOT выполнять backend request или переключаться на user session

### Requirement: API URL resolution

CLI core SHALL resolve backend API URL from runtime sources and code defaults without reading it from `.sdds/config.json`, and SHALL report which source produced the value so that writing commands can reject the code default. Для локального проекта `.env` SHALL предоставлять fallback для `DSBUILDER_API_URL` после env процесса.

#### Scenario: CLI argument имеет высший приоритет

- **WHEN** command receives `--api-url <value>`
- **THEN** CLI MUST use that value as the backend API URL
- **THEN** CLI MUST NOT read env variables for the API URL

#### Scenario: Env API URL используется после CLI argument

- **WHEN** `--api-url` is absent
- **WHEN** env процесса contains `DSBUILDER_API_URL`
- **THEN** CLI MUST use that value as the backend API URL даже при наличии другого значения в проектном `.env`

#### Scenario: Проектный API URL используется после env процесса

- **WHEN** `--api-url` и `DSBUILDER_API_URL` в env процесса отсутствуют
- **WHEN** `.env` найденного локального проекта содержит `DSBUILDER_API_URL`
- **THEN** CLI MUST использовать значение `.env` как явно настроенный backend API URL
- **THEN** writing command MUST NOT считать его code default

#### Scenario: Default API URL используется последним

- **WHEN** `--api-url` is absent
- **WHEN** env процесса и проектный `.env` не содержат `DSBUILDER_API_URL`
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

### Requirement: Credential policy в локальном project config

CLI core SHALL поддерживать `credential.type = "auto"`, `"user-session"` и `"project-key-env"` в `.sdds/config.json` без raw secrets и SHALL читать существующий `"env"` как совместимый `auto` с указанным именем env-переменной.

#### Scenario: Существующий env config

- **WHEN** config содержит `credential.type = "env"` и `credential.name = "PROJECT_KEY"`
- **THEN** CLI MUST продолжить читать этот config без миграции файла
- **THEN** CLI MUST использовать доступный key из разрешённых runtime sources, а при его отсутствии — user session

#### Scenario: Принудительная user session

- **WHEN** config содержит `credential.type = "user-session"`
- **THEN** CLI MUST использовать только session для resolved API URL
- **THEN** CLI MUST NOT читать project key из env или `--api-key`

#### Scenario: Принудительный project key

- **WHEN** config содержит `credential.type = "project-key-env"` и имя env-переменной
- **THEN** CLI MUST использовать только project key из выбранных key sources
- **THEN** отсутствие key MUST вернуть credential error без fallback на user session

### Requirement: Headless credential selection

CLI core SHALL отделять явный `--design-system` от локальной credential policy. Без локального контекста пользовательская session SHALL быть интерактивным умолчанием; project key SHALL выбираться явным указанием имени env-переменной для конкретного вызова.

#### Scenario: Явная ссылка из чужой рабочей директории

- **WHEN** `--design-system` выбирает дизайн-систему A, а текущая `.sdds` относится к B
- **THEN** CLI MUST NOT применять credential policy B к A
- **THEN** CLI MUST использовать явную headless policy или user session

#### Scenario: CI выбирает project key

- **WHEN** headless-команда явно указывает env-переменную с project key
- **THEN** CLI MUST прочитать значение из env, не из URI
- **THEN** CLI MUST NOT сохранять key в `.sdds` или выводить его в diagnostics

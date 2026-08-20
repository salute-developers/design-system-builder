## ADDED Requirements

### Requirement: CLI theme fetch command

CLI `dsbuilder` SHALL provide project-scoped command `theme fetch` for downloading tenants, token meta and token values into the local `.sdds` directory.

#### Scenario: Theme fetch использует project-scoped context

- **WHEN** developer runs `dsbuilder theme fetch` inside an initialized project directory
- **THEN** CLI MUST resolve the nearest `.sdds/config.json`
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST resolve API URL through CLI core
- **THEN** CLI MUST use `projectId` and `designSystemId` from config for design-system scoped requests
- **THEN** CLI MUST include `Authorization: ProjectKey <api_key>` in backend requests
- **THEN** CLI MUST NOT print the raw API key

#### Scenario: Theme fetch принимает runtime overrides

- **WHEN** developer runs `dsbuilder theme fetch --api-key secret --api-url https://api.example.com`
- **THEN** CLI MUST use `secret` as the runtime API key
- **THEN** CLI MUST use `https://api.example.com` as the backend API URL
- **THEN** CLI MUST NOT write the raw API key or API URL into `.sdds/config.json`

### Requirement: Theme fetch backend contract

CLI `theme fetch` SHALL load remote data through the DS Builder project-scoped backend API.

#### Scenario: Theme fetch загружает tenants и tokens

- **WHEN** developer runs `dsbuilder theme fetch`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tenants`
- **THEN** CLI MUST parse the response as a JSON array of `Tenant` objects with fields `id`, `designSystemId`, `name`, `description`, `createdAt`, and `updatedAt`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tokens`
- **THEN** CLI MUST parse the response as a JSON array of `Token` objects with fields `id`, `designSystemId`, `name`, `type`, `displayName`, `description`, `enabled`, `createdAt`, and `updatedAt`

#### Scenario: Theme fetch загружает token values для каждого tenant

- **WHEN** tenants response contains tenant with `id = tenant-a`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/tenants/tenant-a/token-values`
- **THEN** CLI MUST parse the response as a JSON array of `TokenValue` objects with fields `id`, `tokenId`, `tenantId`, `paletteId`, `platform`, `mode`, `value`, `createdAt`, and `updatedAt`

#### Scenario: Backend response cannot be parsed

- **WHEN** backend returns success status with JSON that cannot be parsed according to the expected DTO contract
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT write partial theme files
- **THEN** CLI MUST NOT print the raw API key

### Requirement: Theme fetch updates local config tenants

CLI `theme fetch` SHALL store downloaded tenants in `.sdds/config.json` as non-secret project metadata.

#### Scenario: Tenants сохраняются в config

- **WHEN** backend returns tenants for `theme fetch`
- **THEN** CLI MUST write those tenants into `.sdds/config.json` field `tenants`
- **THEN** CLI MUST preserve existing `projectId`, `designSystemId`, and `credential`
- **THEN** CLI MUST NOT write raw API key values into `.sdds/config.json`
- **THEN** CLI MUST NOT write API URL values into `.sdds/config.json`

### Requirement: Theme fetch tenant directory layout

CLI `theme fetch` SHALL create one local tenant directory inside `.sdds` for each downloaded tenant.

#### Scenario: Tenant directory создается из normalized name

- **WHEN** backend returns tenant with `name = "SDDS CS / Consumer"`
- **THEN** CLI MUST create tenant directory `.sdds/sdds_cs_consumer`
- **THEN** CLI MUST use the normalized directory for that tenant's generated files

#### Scenario: Empty normalized tenant name falls back to id

- **WHEN** backend returns tenant whose `name` normalizes to an empty string
- **THEN** CLI MUST use the tenant `id` as the tenant directory name

#### Scenario: Tenant directory collision uses id suffix

- **WHEN** two tenants normalize to the same directory name
- **THEN** CLI MUST append a deterministic suffix from the tenant `id` to at least one conflicting directory name
- **THEN** CLI MUST NOT merge files from different tenants into the same directory

### Requirement: Theme fetch writes token meta

CLI `theme fetch` SHALL write token meta for every tenant.

#### Scenario: Meta file содержит все tokens

- **WHEN** backend returns token meta for the configured design system
- **THEN** CLI MUST write `.sdds/{tenantDirectory}/meta.json` for each tenant
- **THEN** each `meta.json` MUST contain the full token meta JSON array returned by the tokens endpoint

### Requirement: Theme fetch groups token values by platform and token type

CLI `theme fetch` SHALL group token values by tenant, platform and token type using token meta as the source of token names and types.

#### Scenario: Platform and type files are written

- **WHEN** token meta contains token `token-a` with `name = "screen-s.header.h2.normal"` and `type = "typography"`
- **WHEN** tenant token values contain a value for `tokenId = token-a` and `platform = "android"`
- **THEN** CLI MUST write that value into `.sdds/{tenantDirectory}/android/android_typography.json`
- **THEN** the JSON object MUST use key `screen-s.header.h2.normal`

#### Scenario: Mode does not affect file layout

- **WHEN** tenant token values contain values with `mode = "dark"` and `mode = "light"`
- **THEN** CLI MUST NOT create mode-specific directories
- **THEN** CLI MUST NOT create mode-specific files
- **THEN** CLI MUST rely on token `name` to distinguish dark and light tokens

#### Scenario: Token value without meta is ignored

- **WHEN** tenant token values contain `tokenId` that is absent from token meta
- **THEN** CLI MUST ignore that token value
- **THEN** CLI MUST NOT fail only because of the unknown token value

#### Scenario: Meta token without value fails

- **WHEN** token meta contains an enabled token for a tenant
- **WHEN** tenant token values do not contain a value for that token
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT write partial theme files

### Requirement: Theme fetch normalizes token values

CLI `theme fetch` SHALL convert backend `TokenValue.value` arrays into local JSON values according to token type.

#### Scenario: Color value is written as string

- **WHEN** token type is `color`
- **WHEN** `TokenValue.value` is a JSON array with one string
- **THEN** CLI MUST write the string as the token value

#### Scenario: Typography value is written as object

- **WHEN** token type is `typography`
- **WHEN** `TokenValue.value` is a JSON array whose first item is a JSON object
- **THEN** CLI MUST write the first object as the token value
- **THEN** CLI MUST NOT write an array for that token value

#### Scenario: Shape value is written as object

- **WHEN** token type is `shape`
- **WHEN** `TokenValue.value` is a JSON array whose first item is a JSON object
- **THEN** CLI MUST write the first object as the token value
- **THEN** CLI MUST NOT write an array for that token value

#### Scenario: Font family value is written as object

- **WHEN** token type is `fontFamily`
- **WHEN** `TokenValue.value` is a JSON array whose first item is a JSON object
- **THEN** CLI MUST write the first object as the token value
- **THEN** CLI MUST NOT write an array for that token value

#### Scenario: Gradient value is written as array

- **WHEN** token type is `gradient`
- **THEN** CLI MUST write `TokenValue.value` as a JSON array for that token value

#### Scenario: Shadow value is written as array

- **WHEN** token type is `shadow`
- **THEN** CLI MUST write `TokenValue.value` as a JSON array for that token value

#### Scenario: Invalid token value shape fails

- **WHEN** `TokenValue.value` does not match the expected JSON shape for the token type
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT write partial theme files

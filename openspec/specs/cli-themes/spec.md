# cli-themes Specification

## Purpose
TBD - created by archiving change cli-themes. Update Purpose after archive.
## Requirements
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

#### Scenario: Theme fetch загружает palette

- **WHEN** developer runs `dsbuilder theme fetch`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/palette`
- **THEN** CLI MUST parse the response as a JSON array of `PaletteItem` objects with fields `id`, `type`, `shade`, `saturation`, `value`, `createdAt`, and `updatedAt`

#### Scenario: Theme fetch загружает token values для каждого tenant

- **WHEN** tenants response contains tenant with `id = tenant-a`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/tenants/tenant-a/token-values`
- **THEN** CLI MUST parse the response as a JSON array of `TokenValue` objects with fields `id`, `tokenId`, `tenantId`, `paletteId`, `platform`, `mode`, `value`, `createdAt`, and `updatedAt`

#### Scenario: Backend response cannot be parsed

- **WHEN** backend returns success status with JSON that cannot be parsed according to the expected DTO contract
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT write partial theme files
- **THEN** CLI MUST NOT print the raw API key

### Requirement: Theme fetch writes palette

CLI `theme fetch` SHALL transform backend palette items into a local palette object and write it to `.sdds/tenants/palette.json`.

#### Scenario: Palette file содержит values по shade и saturation

- **WHEN** backend palette response contains item with `shade = "blue"`, `saturation = 100`, and `value = "#EDF8FF"`
- **THEN** CLI MUST write `.sdds/tenants/palette.json`
- **THEN** `palette.json` MUST be a JSON object
- **THEN** `palette.json.blue.100` MUST equal `"#EDF8FF"`

#### Scenario: Palette сохраняется рядом с tenants

- **WHEN** developer runs `dsbuilder theme fetch`
- **THEN** CLI MUST create `.sdds/tenants` when it is absent
- **THEN** CLI MUST write palette to `.sdds/tenants/palette.json`
- **THEN** CLI MUST NOT write palette to a tenant-specific directory

#### Scenario: Duplicate shade saturation использует последнее значение

- **WHEN** backend palette response contains multiple items with the same `shade` and `saturation`
- **THEN** CLI MUST write the value from the last matching item in response order
- **THEN** CLI MUST produce deterministic `palette.json`

#### Scenario: Palette parse failure blocks local writes

- **WHEN** backend palette response cannot be parsed as `PaletteItem` array
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT write `.sdds/tenants/palette.json`
- **THEN** CLI MUST NOT write partial tenant, meta, token value, or config updates from the failed fetch

### Requirement: Theme fetch updates local config tenants

CLI `theme fetch` SHALL store downloaded tenants in `.sdds/config.json` as non-secret project metadata while preserving local aliases for matching tenant IDs.

#### Scenario: Tenants сохраняются в config

- **WHEN** backend returns tenants for `theme fetch`
- **THEN** CLI MUST write those tenants into `.sdds/config.json` field `tenants`
- **THEN** each written tenant MUST contain `directoryPath` pointing to `.sdds/tenants/{tenantDirectory}`
- **THEN** CLI MUST preserve existing `projectId`, `designSystemId`, and `credential`
- **THEN** CLI MUST NOT write raw API key values into `.sdds/config.json`
- **THEN** CLI MUST NOT write API URL values into `.sdds/config.json`

#### Scenario: Theme fetch сохраняет alias существующего tenant

- **WHEN** `.sdds/config.json` contains tenant with `id = tenant-a` and `alias = main`
- **WHEN** backend returns tenant with `id = tenant-a` for `theme fetch`
- **THEN** CLI MUST write refreshed backend metadata for `tenant-a`
- **THEN** CLI MUST preserve `alias = main` for `tenant-a`

#### Scenario: Theme fetch удаляет alias отсутствующего tenant

- **WHEN** `.sdds/config.json` contains tenant with `id = tenant-a` and `alias = main`
- **WHEN** backend response for `theme fetch` does not contain tenant with `id = tenant-a`
- **THEN** CLI MUST NOT keep a stale tenant entry for `tenant-a`
- **THEN** CLI MUST NOT keep alias `main` for the missing tenant

### Requirement: CLI tenant alias commands

CLI `dsbuilder` SHALL provide `theme alias` commands for listing, setting, and unsetting local tenant aliases in `.sdds/config.json`.

#### Scenario: Alias list показывает tenants и aliases

- **WHEN** developer runs `dsbuilder theme alias list` inside an initialized project directory
- **THEN** CLI MUST resolve the nearest `.sdds/config.json`
- **THEN** CLI MUST print tenant `id`, tenant `name`, and alias when present
- **THEN** CLI MUST NOT require backend services, Docker, credentials, or private URLs

#### Scenario: Alias set сохраняет alias для tenant

- **WHEN** developer runs `dsbuilder theme alias set --tenant-id tenant-a --alias main`
- **WHEN** `.sdds/config.json` contains tenant with `id = tenant-a`
- **THEN** CLI MUST write `alias = main` into that tenant entry
- **THEN** CLI MUST preserve existing `projectId`, `designSystemId`, `credential`, and other tenants
- **THEN** CLI MUST NOT write raw API key values or API URL values into `.sdds/config.json`

#### Scenario: Alias set требует существующий tenant

- **WHEN** developer runs `dsbuilder theme alias set --tenant-id missing-tenant --alias main`
- **WHEN** `.sdds/config.json` does not contain tenant with `id = missing-tenant`
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT modify `.sdds/config.json`

#### Scenario: Alias set требует уникальный alias

- **WHEN** developer runs `dsbuilder theme alias set --tenant-id tenant-b --alias main`
- **WHEN** `.sdds/config.json` already contains another tenant with `alias = main`
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT modify `.sdds/config.json`

#### Scenario: Alias set отклоняет пустой alias

- **WHEN** developer runs `dsbuilder theme alias set --tenant-id tenant-a --alias "   "`
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT modify `.sdds/config.json`

#### Scenario: Alias unset удаляет alias

- **WHEN** developer runs `dsbuilder theme alias unset main`
- **WHEN** `.sdds/config.json` contains tenant with `alias = main`
- **THEN** CLI MUST remove the alias from that tenant entry
- **THEN** CLI MUST preserve existing `projectId`, `designSystemId`, `credential`, and tenant metadata

#### Scenario: Alias unset требует существующий alias

- **WHEN** developer runs `dsbuilder theme alias unset missing`
- **WHEN** `.sdds/config.json` does not contain tenant with `alias = missing`
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT modify `.sdds/config.json`

#### Scenario: Alias help не требует project config

- **WHEN** developer runs `dsbuilder theme alias --help`
- **THEN** CLI MUST show deterministic help for alias commands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

### Requirement: Theme fetch tenant directory layout

CLI `theme fetch` SHALL create one local tenant directory inside `.sdds/tenants` for each downloaded tenant.

#### Scenario: Tenant directory создается из normalized name

- **WHEN** backend returns tenant with `name = "SDDS CS / Consumer"`
- **THEN** CLI MUST create tenant directory `.sdds/tenants/sdds_cs_consumer`
- **THEN** CLI MUST use the normalized directory under `.sdds/tenants` for that tenant's generated files

#### Scenario: Empty normalized tenant name falls back to id

- **WHEN** backend returns tenant whose `name` normalizes to an empty string
- **THEN** CLI MUST use the tenant `id` as the tenant directory name under `.sdds/tenants`

#### Scenario: Tenant directory collision uses id suffix

- **WHEN** two tenants normalize to the same directory name
- **THEN** CLI MUST append a deterministic suffix from the tenant `id` to at least one conflicting directory name
- **THEN** CLI MUST NOT merge files from different tenants into the same directory

### Requirement: Theme fetch writes token meta

CLI `theme fetch` SHALL write structured token meta for every tenant.

#### Scenario: Meta file содержит tenant metadata и все tokens

- **WHEN** backend returns tenant `name = "SDDS CS"` and token meta for the configured design system
- **THEN** CLI MUST write `.sdds/tenants/{tenantDirectory}/meta.json` for each tenant
- **THEN** each `meta.json` MUST be a JSON object
- **THEN** each `meta.json` MUST contain `name = "SDDS CS"`
- **THEN** each `meta.json` MUST contain `version = "latest"`
- **THEN** each `meta.json` MUST contain `tokens` with the full token meta array returned by the tokens endpoint

#### Scenario: Meta token содержит tags из имени token

- **WHEN** token meta contains token with `name = "screen-s.header.h2.normal"`
- **THEN** the corresponding token object in `meta.json.tokens` MUST contain `tags = ["screen-s", "header", "h2", "normal"]`

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

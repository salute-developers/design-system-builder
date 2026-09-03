## MODIFIED Requirements

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

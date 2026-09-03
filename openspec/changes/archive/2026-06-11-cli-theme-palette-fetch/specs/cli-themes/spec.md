## MODIFIED Requirements

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

## ADDED Requirements

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

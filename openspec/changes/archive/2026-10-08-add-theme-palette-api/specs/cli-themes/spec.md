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
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/tenants/tenant-a/token-values?resolvePalette=true`
- **THEN** CLI MUST parse the response as a JSON array of `TokenValue` objects with fields `id`, `tokenId`, `tenantId`, `paletteId`, `platform`, `mode`, `value`, `createdAt`, and `updatedAt` and optional field `paletteRef`

#### Scenario: Цвет токена вычислен по палитре темы

- **WHEN** backend возвращает цветовое значение с `value = ["#0A8F7ACC"]` и `paletteRef = "[general.green.500][0.8]"`
- **THEN** CLI MUST записать `"#0A8F7ACC"` как значение токена
- **THEN** CLI MUST NOT заменять это значение по `.sdds/tenants/palette.json`

#### Scenario: Backend response cannot be parsed

- **WHEN** backend returns success status with JSON that cannot be parsed according to the expected DTO contract
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT write partial theme files
- **THEN** CLI MUST NOT print the raw API key

## MODIFIED Requirements

### Requirement: Project config stores no raw secrets

CLI project config SHALL store only non-secret project metadata, local tenant aliases, and credential references.

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

## ADDED Requirements

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


## MODIFIED Requirements

### Requirement: Project config stores no raw secrets

CLI project config SHALL store only non-secret project metadata and credential references.

#### Scenario: Config содержит env credential reference

- **WHEN** `.sdds/config.json` is generated or parsed
- **THEN** it MUST support `projectId`
- **THEN** it MUST support `designSystemId`
- **THEN** it MUST support JSON object `credential` with `type = "env"` and `name`

#### Scenario: Config содержит optional tenants metadata

- **WHEN** `.sdds/config.json` is generated, parsed, or updated by `theme fetch`
- **THEN** it MUST support optional JSON array field `tenants`
- **THEN** each tenant entry MUST support fields `id`, `designSystemId`, `name`, `description`, `createdAt`, and `updatedAt`
- **THEN** config without `tenants` MUST remain valid

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

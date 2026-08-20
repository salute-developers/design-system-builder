## MODIFIED Requirements

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

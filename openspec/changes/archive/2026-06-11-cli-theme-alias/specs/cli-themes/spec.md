## MODIFIED Requirements

### Requirement: Theme fetch updates local config tenants

CLI `theme fetch` SHALL store downloaded tenants in `.sdds/config.json` as non-secret project metadata while preserving local aliases for matching tenant IDs.

#### Scenario: Tenants сохраняются в config

- **WHEN** backend returns tenants for `theme fetch`
- **THEN** CLI MUST write those tenants into `.sdds/config.json` field `tenants`
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

## ADDED Requirements

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

# Spec Delta

## REMOVED Requirements

### Requirement: Components fetch saves web generation meta

**Reason**: заменено одним файлом web-адаптера.
**Migration**: `.sdds/web/meta-template.json` и `.sdds/web/meta-dependencies.json` больше не пишутся; их данные лежат в `.sdds/web/web-adapter.json`.

### Requirement: Web generation meta endpoint

**Reason**: ручка `web-meta` заменена ручкой `web-adapter`.
**Migration**: `POST /ds/component-config/web-adapter`.

## ADDED Requirements

### Requirement: Components fetch saves web adapter

`components fetch` for the React platform SHALL load the web adapter from a dedicated endpoint the same
way as the legacy snapshot and save it as is to `.sdds/web/web-adapter.json`. This is a temporary contract
for local web generation and SHALL NOT change the component package model, `meta.json` or configuration
files.

#### Scenario: Web-адаптер сохраняется в .sdds/web

- **WHEN** the platform resolves to `react` (explicit `--platform`, otherwise the single platform of project config) and package export succeeds
- **THEN** CLI MUST request `POST /api/projects/{projectId}/ds/component-config/web-adapter` with `designSystemId` in the body before writing any file
- **THEN** CLI MUST write the response to `web/web-adapter.json` beside the discovered project config, or to `<to>/web/web-adapter.json` without local project config
- **THEN** a repeated fetch MUST replace the file

#### Scenario: Без React адаптер не загружается

- **WHEN** the platform resolves to another platform, or cannot be resolved because project config declares none or several
- **THEN** fetch MUST NOT fail because of it
- **THEN** CLI MUST NOT request the web adapter and MUST NOT write `.sdds/web`

#### Scenario: Ошибка загрузки останавливает fetch до записи

- **WHEN** the platform resolves to `react` and the request fails or the response is not a JSON array
- **THEN** CLI MUST return a failure and MUST NOT write any file

#### Scenario: Push не читает web-адаптер

- **WHEN** developer runs `dsbuilder components push`
- **THEN** CLI MUST NOT read or send `web-adapter.json`

### Requirement: Web adapter endpoint

`POST /ds/component-config/web-adapter` SHALL return a JSON array with one entry per component that has a
configuration in the design system, ordered by `componentName` (the component name in the `meta.json` spelling).

#### Scenario: Имя и описание из базы

- **WHEN** a component of the package is returned
- **THEN** `name` MUST be the component name from the database
- **THEN** `description` MUST be the component description from the database and MUST be omitted when empty

#### Scenario: Шаблоны по стилю

- **WHEN** a value of a configuration has a web parameter adjustment with a template
- **THEN** `styles.<styleName>.templates` MUST map the property name to the parameter name and the template
- **THEN** styles without templates MUST NOT be listed

#### Scenario: Compose-связи между компонентами пакета

- **WHEN** components of the package have `compose` dependencies
- **THEN** `compose` of the parent MUST list its children in dependency order
- **THEN** a child absent from the package and `reuse` dependencies MUST NOT be listed

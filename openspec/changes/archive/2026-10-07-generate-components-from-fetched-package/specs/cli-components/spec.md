# Spec Delta

## ADDED Requirements

### Requirement: Components fetch saves web generation meta

`components fetch` for the React platform SHALL load web generation meta from a dedicated endpoint the same
way as the legacy snapshot and save it in `.sdds/web` as is. This is a temporary contract for local web
generation and SHALL NOT change the component package model, `meta.json` or configuration files.

#### Scenario: Данные web-генерации сохраняются в .sdds/web

- **WHEN** the platform resolves to `react` (explicit `--platform`, otherwise the single platform of project config) and package export succeeds
- **THEN** CLI MUST request `POST /api/projects/{projectId}/ds/component-config/web-meta` with `designSystemId` in the body before writing any file
- **THEN** CLI MUST write the `template` object to `meta-template.json` and the `dependencies` object to `meta-dependencies.json` in `web/` beside the discovered project config, or in `<to>/web` without local project config
- **THEN** a repeated fetch MUST replace both files

#### Scenario: Без React данные не загружаются

- **WHEN** the platform resolves to another platform, or cannot be resolved because project config declares none or several
- **THEN** fetch MUST NOT fail because of it
- **THEN** CLI MUST NOT request web generation meta and MUST NOT write `.sdds/web`

#### Scenario: Ошибка загрузки останавливает fetch до записи

- **WHEN** the platform resolves to `react` and the request fails or the response has no `template` or `dependencies` object
- **THEN** CLI MUST return a failure and MUST NOT write any file

#### Scenario: Push не читает данные web-генерации

- **WHEN** developer runs `dsbuilder components push`
- **THEN** CLI MUST NOT read or send `meta-template.json` and `meta-dependencies.json`

### Requirement: Web generation meta endpoint

`POST /ds/component-config/web-meta` SHALL return `template.components` and `dependencies.compose`
for the configurations of the design system.

#### Scenario: Шаблоны по конфигурации

- **WHEN** a value of a configuration has a web parameter adjustment with a template
- **THEN** `template.components` MUST contain an entry for that `componentName` and `styleName` mapping the property name to the parameter name and the template
- **THEN** configurations without templates MUST NOT be listed

#### Scenario: Compose-связи между компонентами пакета

- **WHEN** components of the package have `compose` dependencies
- **THEN** `dependencies.compose` MUST map the parent to its children in dependency order
- **THEN** a child absent from the package and `reuse` dependencies MUST NOT be listed

### Requirement: Export restores offsets from platform parameter adjustments

`POST /ds/component-config/export` SHALL return `adjustment` from platform parameter adjustments when the
value row has none.

#### Scenario: Смещение из поправок платформенных параметров

- **WHEN** a value row has no `adjustment` but a numeric platform parameter adjustment differing from the value
- **THEN** export MUST return that offset as `adjustment`, preferring web, then xml, compose, ios

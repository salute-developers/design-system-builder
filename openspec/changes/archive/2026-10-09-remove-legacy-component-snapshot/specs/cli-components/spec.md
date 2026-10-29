# Spec Delta

## REMOVED Requirements

### Requirement: Components fetch saves legacy snapshot

**Reason**: снимок `component-configs.json` читала только локальная web-генерация, а она больше его не использует.
**Migration**: `components fetch` не запрашивает `GET /ds/legacy/design-systems/{name}/component-configs` и не пишет `.sdds/component-configs.json`; ранее скачанный файл можно удалить вручную.

## MODIFIED Requirements

### Requirement: Components fetch saves web adapter

`components fetch` for the React platform SHALL load the web adapter from a dedicated endpoint before writing
any file and save the response as is to `.sdds/web/web-adapter.json`. This is a temporary contract
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

## ADDED Requirements

### Requirement: Components fetch does not use the legacy endpoint

`components fetch` SHALL NOT request the legacy component configs endpoint.

#### Scenario: Нет запроса legacy-ручки

- **WHEN** developer runs `dsbuilder components fetch` or `dsbuilder ds fetch`
- **THEN** CLI MUST NOT request `GET /api/projects/{projectId}/ds/legacy/design-systems/{name}/component-configs`
- **THEN** CLI MUST NOT write or delete `.sdds/component-configs.json`

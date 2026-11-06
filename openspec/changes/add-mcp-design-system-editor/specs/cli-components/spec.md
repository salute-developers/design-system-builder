## MODIFIED Requirements

### Requirement: Components fetch saves web adapter

`components fetch` for the React platform SHALL load the web adapter from a dedicated endpoint before writing
any file and save the response as is to `.sdds/web/web-adapter.json`. This is a temporary contract
for local web generation and SHALL NOT change the component package model, `meta.json` or configuration
files.

#### Scenario: Web-адаптер сохраняется в .sdds/web

- **WHEN** the platform resolves to `react` (explicit `--platform`, otherwise the single platform of project config) and package export succeeds
- **THEN** CLI MUST request `POST /api/projects/{projectId}/design-systems/{designSystemId}/component-config/web-adapter` with `designSystemId` in the body before writing any file
- **THEN** CLI MUST write the response to `web/web-adapter.json` beside the discovered project config, or to `<to>/web/web-adapter.json` without local project config
- **THEN** a repeated fetch MUST replace the file

#### Scenario: Без React адаптер не загружается

- **WHEN** the platform resolves to another platform than `react`
- **THEN** CLI MUST NOT request the web adapter and MUST NOT write `.sdds/web`

#### Scenario: Ошибка загрузки останавливает fetch до записи

- **WHEN** the platform resolves to `react` and the request fails or the response is not a JSON array
- **THEN** CLI MUST return a failure and MUST NOT write any file

#### Scenario: Push не читает web-адаптер

- **WHEN** developer runs `dsbuilder components push`
- **THEN** CLI MUST NOT read or send `web-adapter.json`

## REMOVED Requirements

### Requirement: Components push backend contract

**Reason**: Область DS переносится из неявной адресации в обязательный URL.
**Migration**: Использовать новый контракт Контракт импорта компонентов в выбранную DS.


### Requirement: Components fetch backend contract

**Reason**: Область DS переносится из неявной адресации в обязательный URL.
**Migration**: Использовать новый контракт Контракт выгрузки компонентов выбранной DS.


## ADDED Requirements

### Requirement: Контракт импорта компонентов в выбранную DS

CLI `components push` SHALL upload the whole package in a single request to the component-config import endpoint, с обязательным designSystemId в URL; прежнее одноимённое поле тела MUST совпадать с ним, а platform остаётся в теле.

#### Scenario: Push отправляет один запрос

- **WHEN** CLI has converted the package
- **THEN** CLI MUST send `POST /api/projects/{projectId}/design-systems/{designSystemId}/component-config/import`
- **THEN** the request body MUST contain `designSystemId` taken from the project config
- **THEN** the request body MUST contain `platform` resolved from the project config
- **THEN** the request body MUST contain the package metadata and all converted component configurations
- **THEN** CLI MUST NOT send one request per component

#### Scenario: Путь запроса содержит идентификатор дизайн-системы

- **WHEN** CLI builds the import request path
- **THEN** путь MUST содержать обязательный designSystemId выбранной системы
- **THEN** the path MUST NOT contain a custom method separated by a colon

#### Scenario: Dry run передаётся в запросе

- **WHEN** CLI performs a dry run
- **THEN** the import request MUST mark the operation as non-persisting

#### Scenario: Push печатает отчёт

- **WHEN** the backend returns a successful import response
- **THEN** CLI MUST print the number of created, updated, unchanged, and rejected component configurations
- **THEN** CLI MUST print rejected entries with the reason returned by the backend

#### Scenario: Backend возвращает ошибку

- **WHEN** the backend returns a non-successful status
- **THEN** CLI MUST map the response through common CLI core HTTP error handling
- **THEN** CLI MUST print a deterministic failure message without raw API key values

#### Scenario: Backend response cannot be parsed

- **WHEN** backend returns success status with a body that cannot be parsed as the import report
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT print a partial report

### Requirement: Контракт выгрузки компонентов выбранной DS

CLI `components fetch` SHALL download the whole package in a single request to the component-config
export endpoint, с обязательным designSystemId в URL; прежнее одноимённое поле тела MUST совпадать с ним, а platform остаётся в теле.

#### Scenario: Fetch отправляет один запрос

- **WHEN** CLI performs a fetch
- **THEN** CLI MUST send `POST /api/projects/{projectId}/design-systems/{designSystemId}/component-config/export`
- **THEN** the request body MUST contain `designSystemId` taken from the project config
- **THEN** the request body MUST contain `platform` resolved from the project config
- **THEN** CLI MUST NOT send one request per component

#### Scenario: Путь запроса содержит идентификатор дизайн-системы

- **WHEN** CLI builds the export request path
- **THEN** путь MUST содержать обязательный designSystemId выбранной системы
- **THEN** the path MUST NOT contain a custom method separated by a colon

#### Scenario: Backend возвращает ошибку

- **WHEN** the backend returns a non-successful status
- **THEN** CLI MUST map the response through common CLI core HTTP error handling
- **THEN** CLI MUST print a deterministic failure message without raw API key values
- **THEN** CLI MUST NOT write any file

#### Scenario: Backend response cannot be parsed

- **WHEN** backend returns success status with a body that cannot be parsed as the export package
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT write a partial package

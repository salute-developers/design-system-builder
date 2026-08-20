## MODIFIED Requirements

### Requirement: Components push backend contract

CLI `components push` SHALL upload the whole package in a single request to the component-config import endpoint, addressing the design system by `designSystemId` in the request body.

#### Scenario: Push отправляет один запрос

- **WHEN** CLI has converted the package
- **THEN** CLI MUST send `POST /api/projects/{projectId}/ds/component-config/import`
- **THEN** the request body MUST contain `designSystemId` taken from the project config
- **THEN** the request body MUST contain the package metadata and all converted component configurations
- **THEN** CLI MUST NOT send one request per component

#### Scenario: Путь запроса не содержит идентификатор дизайн-системы

- **WHEN** CLI builds the import request path
- **THEN** the path MUST NOT contain `designSystemId` as a path segment
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

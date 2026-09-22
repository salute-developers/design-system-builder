## MODIFIED Requirements

### Requirement: Components push requires explicit backend target

CLI `components push` SHALL refuse to run when the backend API URL was resolved from the code default, because the code default points at a shared backend installation. Команда SHALL сначала разрешить локальный context, чтобы проектный `.env` мог предоставить явно настроенный API URL.

#### Scenario: Push без явного API URL отклоняется

- **WHEN** developer runs `dsbuilder components push` в инициализированном проекте
- **WHEN** `--api-url` is absent
- **WHEN** env процесса и проектный `.env` не содержат `DSBUILDER_API_URL`
- **THEN** CLI MUST return a deterministic failure output explaining that a backend API URL must be provided explicitly
- **THEN** the message MUST name both `--api-url` and `DSBUILDER_API_URL`
- **THEN** CLI MUST NOT send any backend request

#### Scenario: Push принимает явный API URL

- **WHEN** developer runs `dsbuilder components push --api-url http://localhost:8080`
- **THEN** CLI MUST use `http://localhost:8080` as the backend API URL
- **THEN** CLI MUST NOT write the API URL into `.sdds/config.json`

#### Scenario: Push принимает проектный API URL

- **WHEN** локальная `.sdds/config.json` найдена и соседний `.env` содержит `DSBUILDER_API_URL`
- **WHEN** `--api-url` и env процесса не задают URL
- **THEN** CLI MUST использовать URL из `.env` как явно настроенный backend target

#### Scenario: Push печатает resolved target перед записью

- **WHEN** `dsbuilder components push` is about to send data to the backend
- **THEN** CLI MUST print the resolved backend API URL
- **THEN** CLI MUST print the source of that URL
- **THEN** CLI MUST print `projectId` and `designSystemId` used for the request
- **THEN** CLI MUST NOT print the raw API key

#### Scenario: Push печатает состав отправляемого пакета

- **WHEN** `dsbuilder components push` is about to send data to the backend
- **THEN** CLI MUST print `meta.json.name` of the package being sent
- **THEN** CLI MUST print the resolved source of the package
- **THEN** CLI MUST print the number of component configurations in the package
- **THEN** CLI MUST print this together with the resolved target, so that both sides can be compared before an apply

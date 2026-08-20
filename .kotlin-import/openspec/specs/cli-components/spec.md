# cli-components Specification

## Purpose
Определяет project-scoped команды `components` CLI `dsbuilder`: загрузку конфигураций компонентов дизайн-системы из локального пакета в backend DS Builder, dry run по умолчанию и требование явного backend API URL.
## Requirements
### Requirement: CLI components push command

CLI `dsbuilder` SHALL provide project-scoped command `components push` for uploading component configurations of a design system into the DS Builder backend.

#### Scenario: Components push использует project-scoped context

- **WHEN** developer runs `dsbuilder components push` inside an initialized project directory
- **THEN** CLI MUST resolve the nearest `.sdds/config.json`
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST use `projectId` and `designSystemId` from config for design-system scoped requests
- **THEN** CLI MUST include `Authorization: ProjectKey <api_key>` in backend requests
- **THEN** CLI MUST NOT print the raw API key

#### Scenario: Components push help не требует project config

- **WHEN** developer runs `dsbuilder components --help` or `dsbuilder components push --help`
- **THEN** CLI MUST show deterministic help
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

### Requirement: Components push requires explicit backend target

CLI `components push` SHALL refuse to run when the backend API URL was resolved from the code default, because the code default points at a shared backend installation.

#### Scenario: Push без явного API URL отклоняется

- **WHEN** developer runs `dsbuilder components push`
- **WHEN** `--api-url` is absent
- **WHEN** environment does not contain `DSBUILDER_API_URL`
- **THEN** CLI MUST return a deterministic failure output explaining that a backend API URL must be provided explicitly
- **THEN** the message MUST name both `--api-url` and `DSBUILDER_API_URL`
- **THEN** CLI MUST NOT send any backend request

#### Scenario: Push принимает явный API URL

- **WHEN** developer runs `dsbuilder components push --api-url http://localhost:8080`
- **THEN** CLI MUST use `http://localhost:8080` as the backend API URL
- **THEN** CLI MUST NOT write the API URL into `.sdds/config.json`

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

### Requirement: Components push is dry run by default

CLI `components push` SHALL perform a non-destructive dry run unless the developer explicitly requests an apply.

#### Scenario: Push без --apply выполняет dry run

- **WHEN** developer runs `dsbuilder components push --api-url http://localhost:8080`
- **THEN** CLI MUST request an import plan from the backend without persisting changes
- **THEN** CLI MUST print the plan
- **THEN** CLI MUST print that no changes were applied

#### Scenario: Push с --apply выполняет запись

- **WHEN** developer runs `dsbuilder components push --api-url http://localhost:8080 --apply`
- **THEN** CLI MUST request a persisting import
- **THEN** CLI MUST print the resulting report

#### Scenario: Одновременные --apply и --dry-run отклоняются

- **WHEN** developer runs `dsbuilder components push --apply --dry-run`
- **THEN** CLI MUST return a deterministic option error
- **THEN** CLI MUST NOT send any backend request

### Requirement: Components push local source

CLI `components push` SHALL read native component configurations from the local `.sdds/components` directory by default.

#### Scenario: Push читает локальную директорию по умолчанию

- **WHEN** developer runs `dsbuilder components push` without `--from`
- **THEN** CLI MUST read `meta.json` from `.sdds/components`
- **THEN** CLI MUST read every configuration file listed in `meta.json.components[].config` from the same directory

#### Scenario: Push принимает произвольную локальную директорию

- **WHEN** developer runs `dsbuilder components push --from ./configs`
- **THEN** CLI MUST read `meta.json` and configuration files from `./configs`

#### Scenario: Отсутствующая локальная директория

- **WHEN** the resolved local source directory does not exist
- **THEN** CLI MUST return a deterministic failure output naming the directory
- **THEN** CLI MUST NOT send any backend request

#### Scenario: Отсутствующий meta.json

- **WHEN** the resolved local source directory does not contain `meta.json`
- **THEN** CLI MUST return a deterministic failure output
- **THEN** CLI MUST NOT send any backend request

### Requirement: Components package metadata contract

CLI `components push` SHALL treat `meta.json` as an inseparable part of the component package and SHALL use it as the source of component identity.

#### Scenario: Meta описывает состав пакета

- **WHEN** CLI reads a component package
- **THEN** `meta.json` MUST contain string field `name`
- **THEN** `meta.json` MUST contain array field `components`
- **THEN** each entry MUST contain `componentName`, `styleName`, and `config`

#### Scenario: Идентичность компонента задаётся парой

- **WHEN** `meta.json` contains entries with the same `componentName` and different `styleName`
- **THEN** CLI MUST treat each entry as a separate component configuration
- **THEN** CLI MUST send both entries in the same import request

#### Scenario: Конфигурация из meta отсутствует в пакете

- **WHEN** `meta.json` references a `config` file that is absent from the package
- **THEN** CLI MUST return a deterministic failure output naming the missing file
- **THEN** CLI MUST NOT send any backend request

#### Scenario: Meta version не используется как версия пакета

- **WHEN** `meta.json` contains field `version`
- **THEN** CLI MUST NOT use that field as the version of the pushed package
- **THEN** CLI MUST report the requested version or local source path instead

### Requirement: Components push does not verify design system identity

CLI `components push` SHALL NOT compare `meta.json.name` against any backend-side name, because no field is known to be comparable with it. Protection against pushing into the wrong design system SHALL rest on the explicit backend target, the printed package and target, and the dry run default.

#### Scenario: Push не сверяет имена

- **WHEN** developer runs `dsbuilder components push --apply`
- **THEN** CLI MUST NOT request the design system in order to compare names
- **THEN** CLI MUST NOT refuse the push because of a name mismatch

#### Scenario: Отсутствие сверки компенсируется выводом

- **WHEN** `dsbuilder components push` is about to send data to the backend
- **THEN** CLI MUST print both the package name and the resolved target before sending
- **THEN** CLI MUST perform a dry run unless `--apply` was requested

### Requirement: Components push transforms native configurations

CLI `components push` SHALL convert every native component configuration into the common format before sending it to the backend.

#### Scenario: Конфигурации преобразуются в common формат

- **WHEN** CLI has read a component package
- **THEN** CLI MUST convert each native configuration into the common format
- **THEN** CLI MUST send the converted configurations, not the native ones

#### Scenario: Ошибка преобразования блокирует весь push

- **WHEN** at least one configuration in the package cannot be converted
- **THEN** CLI MUST return a deterministic failure output naming the component and the configuration file
- **THEN** CLI MUST NOT send a partial import request

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


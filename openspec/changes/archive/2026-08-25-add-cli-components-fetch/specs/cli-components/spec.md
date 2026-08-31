## ADDED Requirements

### Requirement: CLI components fetch command

CLI `dsbuilder` SHALL provide project-scoped command `components fetch` for downloading component
configurations of a design system from the DS Builder backend into a local component package.

#### Scenario: Components fetch использует project-scoped context

- **WHEN** developer runs `dsbuilder components fetch` inside an initialized project directory
- **THEN** CLI MUST resolve the nearest `.sdds/config.json`
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST use `projectId` and `designSystemId` from config for the request
- **THEN** CLI MUST include `Authorization: ProjectKey <api_key>` in backend requests
- **THEN** CLI MUST NOT print the raw API key

#### Scenario: Components fetch help не требует project config

- **WHEN** developer runs `dsbuilder components fetch --help`
- **THEN** CLI MUST show deterministic help
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Fetch печатает resolved source перед записью

- **WHEN** `dsbuilder components fetch` has received the package from the backend
- **THEN** CLI MUST print the resolved backend API URL and the source of that URL
- **THEN** CLI MUST print `projectId` and `designSystemId` used for the request
- **THEN** CLI MUST print the package name, its version and the number of configurations
- **THEN** CLI MUST print the target directory

### Requirement: Components fetch backend contract

CLI `components fetch` SHALL download the whole package in a single request to the component-config
export endpoint, addressing the design system by `designSystemId` in the request body.

#### Scenario: Fetch отправляет один запрос

- **WHEN** CLI performs a fetch
- **THEN** CLI MUST send `POST /api/projects/{projectId}/ds/component-config/export`
- **THEN** the request body MUST contain `designSystemId` taken from the project config
- **THEN** CLI MUST NOT send one request per component

#### Scenario: Путь запроса не содержит идентификатор дизайн-системы

- **WHEN** CLI builds the export request path
- **THEN** the path MUST NOT contain `designSystemId` as a path segment
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

### Requirement: Components fetch transforms common configurations

CLI `components fetch` SHALL convert every common configuration received from the backend into the
native format before writing it to disk.

#### Scenario: Конфигурации преобразуются в native формат

- **WHEN** CLI has received a package
- **THEN** CLI MUST convert each common configuration into the native format
- **THEN** CLI MUST write the converted configurations, not the common ones

#### Scenario: Ошибка преобразования блокирует весь fetch

- **WHEN** at least one configuration in the package cannot be converted
- **THEN** CLI MUST return a deterministic failure output naming the component and the style
- **THEN** CLI MUST NOT write a partial package

### Requirement: Components fetch writes into the working copy

CLI `components fetch` SHALL write the package into the local component directory in place, so that
the result is visible as a diff in version control.

#### Scenario: Fetch пишет в локальную директорию по умолчанию

- **WHEN** developer runs `dsbuilder components fetch` without `--to`
- **THEN** CLI MUST write `meta.json` and configuration files into `.sdds/components`

#### Scenario: Fetch принимает произвольную локальную директорию

- **WHEN** developer runs `dsbuilder components fetch --to ./configs`
- **THEN** CLI MUST write the package into `./configs`

#### Scenario: Существующие файлы перезаписываются на месте

- **WHEN** the target directory already contains a file that the package also contains
- **THEN** CLI MUST overwrite that file
- **THEN** CLI MUST NOT rename it and MUST NOT write the new content beside it

#### Scenario: Файлы вне пакета не удаляются

- **WHEN** the target directory contains configuration files that the new `meta.json` does not reference
- **THEN** CLI MUST leave those files in place
- **THEN** CLI MUST print them as unreferenced

#### Scenario: Отсутствующая целевая директория создаётся

- **WHEN** the resolved target directory does not exist
- **THEN** CLI MUST create it
- **THEN** CLI MUST write the package into it

### Requirement: Components fetch assembles package metadata

CLI `components fetch` SHALL assemble `meta.json` in the form consumed by the theme builder plugin,
and SHALL keep configuration file names stable across runs.

#### Scenario: Meta описывает состав пакета

- **WHEN** CLI writes a package
- **THEN** `meta.json` MUST contain string field `name` taken from the exported package
- **THEN** `meta.json` MUST contain string field `version` taken from the exported package
- **THEN** `meta.json` MUST contain array field `components`
- **THEN** each entry MUST contain `componentName`, `styleName` and `config`

#### Scenario: Имя файла переиспользуется из существующего пакета

- **WHEN** the target directory already contains a `meta.json`
- **WHEN** it references a pair of `componentName` and `styleName` that the new package also contains
- **THEN** CLI MUST reuse the file name recorded for that pair
- **THEN** CLI MUST NOT rename the file

#### Scenario: Имя файла для новой пары строится правилом

- **WHEN** a pair of `componentName` and `styleName` is absent from the existing `meta.json`
- **WHEN** the target directory contains no `meta.json`
- **THEN** CLI MUST build the file name from `styleName` by replacing every `.` and `-` with `_` and appending `_config.json`

#### Scenario: Коллизия имён файлов отклоняется

- **WHEN** two entries of the package resolve to the same file name
- **THEN** CLI MUST return a deterministic failure output naming both entries and the file name
- **THEN** CLI MUST NOT write any file

#### Scenario: Вывод детерминирован

- **WHEN** CLI writes `meta.json`
- **THEN** entries MUST be ordered by `componentName` and then by `styleName`
- **THEN** repeating a fetch without intervening backend changes MUST produce byte-identical files

### Requirement: Components fetch reports what the model did not keep

CLI `components fetch` SHALL report configuration parts that the backend could not return, because
a package written from an incomplete model is not equivalent to the package that was pushed.

Properties absent from the global layer SHALL NOT be part of this report: their values were never
stored, nothing in the model records them, and `components push` already reports them when it
discovers them.

#### Scenario: Fetch печатает значения с невыведенным типом

- **WHEN** the backend reports values whose type could not be derived because their token reference is unresolved
- **THEN** CLI MUST print them as a list
- **THEN** CLI MUST print that the type written for them is the type of the property, not a derived one

#### Scenario: Отчёт не отменяет запись

- **WHEN** the backend reports such properties or values
- **THEN** CLI MUST still write the package
- **THEN** CLI MUST exit with a success status

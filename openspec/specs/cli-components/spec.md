# cli-components Specification

## Purpose
Определяет project-scoped команды `components` CLI `dsbuilder`: загрузку конфигураций компонентов дизайн-системы из локального пакета в backend DS Builder, dry run по умолчанию и требование явного backend API URL.
## Requirements
### Requirement: CLI components push command

CLI `dsbuilder` SHALL предоставлять project-scoped команду `components push` для отправки конфигураций компонентов дизайн-системы в backend DS Builder с выбранным credential.

#### Scenario: Components push использует project-scoped context

- **WHEN** разработчик запускает `dsbuilder components push` внутри initialized project directory
- **THEN** CLI MUST разрешить ближайшую `.sdds/config.json`
- **THEN** CLI MUST разрешить credential через CLI core
- **THEN** CLI MUST использовать `projectId` и `designSystemId` из config
- **THEN** CLI MUST отправить `Authorization: ProjectKey <key>` либо `Authorization: Bearer <token>` согласно policy
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Components push help не требует project config

- **WHEN** разработчик запускает `dsbuilder components --help` или `dsbuilder components push --help`
- **THEN** CLI MUST показать deterministic help
- **THEN** CLI MUST NOT требовать `.sdds/config.json`, backend, credential или private URL

#### Scenario: Components push с user session

- **WHEN** config выбирает `user-session` и backend разрешает операцию пользователю
- **THEN** CLI MUST выполнить запрос с Bearer access token без project key

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

### Requirement: CLI components fetch command

CLI `dsbuilder` SHALL предоставлять project-scoped команду `components fetch` для загрузки конфигураций компонентов дизайн-системы из backend DS Builder в локальный component package с выбранным credential.

#### Scenario: Components fetch использует project-scoped context

- **WHEN** разработчик запускает `dsbuilder components fetch` внутри initialized project directory
- **THEN** CLI MUST разрешить ближайшую `.sdds/config.json`
- **THEN** CLI MUST разрешить credential через CLI core
- **THEN** CLI MUST использовать `projectId` и `designSystemId` из config для запроса
- **THEN** CLI MUST отправить `Authorization: ProjectKey <key>` либо `Authorization: Bearer <token>` согласно policy
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Components fetch help не требует project config

- **WHEN** разработчик запускает `dsbuilder components fetch --help`
- **THEN** CLI MUST показать deterministic help
- **THEN** CLI MUST NOT требовать `.sdds/config.json`, backend, credential или private URL

#### Scenario: Fetch печатает resolved source перед записью

- **WHEN** `dsbuilder components fetch` получил package от backend
- **THEN** CLI MUST вывести resolved backend API URL и источник этого URL
- **THEN** CLI MUST вывести `projectId` и `designSystemId`, использованные для запроса
- **THEN** CLI MUST вывести имя package, его version и число configurations
- **THEN** CLI MUST вывести target directory
- **THEN** CLI MUST NOT выводить raw credential

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
- **THEN** if this normalized style name occurs on multiple components in the export, new file names MUST use `{componentName}_{styleName}` with the same normalization and suffix
- **THEN** existing names from `meta.json` MUST remain unchanged; any remaining collision MUST be rejected before writing

#### Scenario: Different components use the default style

- **WHEN** a new package contains `accordion/default`, `badge/default` and `button/default`
- **THEN** CLI MUST write `accordion_default_config.json`, `badge_default_config.json` and `button_default_config.json`
- **THEN** `meta.json` MUST reference the corresponding file for each pair

#### Scenario: Коллизия вычисленных имён разрешается полной идентичностью

- **WHEN** two new entries produce the same file name from `styleName`
- **THEN** CLI MUST build their file names from `componentName` and `styleName`, normalizing each by the same rule
- **THEN** repeating a fetch MUST produce the same names

#### Scenario: Коллизия унаследованных имён файлов отклоняется

- **WHEN** two entries reuse the same file name from the existing `meta.json`
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

### Requirement: Components fetch saves legacy snapshot

`components fetch` SHALL load the legacy component configs in `feature-components` using the same
project context, API URL and credentials as package export.
`theme fetch` SHALL NOT load or modify this snapshot.

#### Scenario: Snapshot is saved beside project config

- **WHEN** package export succeeds
- **THEN** CLI MUST take the design-system name from the export metadata
- **THEN** CLI MUST request `GET /api/projects/{projectId}/ds/legacy/design-systems/{name}/component-configs`, encoding the name as one path segment
- **THEN** CLI MUST validate the response as a JSON array and save the original response text in `.sdds/component-configs.json` beside the discovered project config
- **THEN** `--to` MUST affect only the component package directory, not the snapshot path
- **THEN** a successful repeat fetch MUST replace the snapshot, including with an empty array

#### Scenario: Snapshot cannot be loaded

- **WHEN** the snapshot request fails or its response is not a valid JSON array
- **THEN** CLI MUST return a nonzero exit code without writing the package or snapshot
- **THEN** CLI MUST NOT expose response bodies or credentials

#### Scenario: Snapshot cannot be written

- **WHEN** writing the snapshot fails
- **THEN** CLI MUST report failure with a nonzero exit code

#### Scenario: Explicit link without local config

- **WHEN** `components fetch --design-system <uri> --to <directory>` runs without a local `.sdds/config.json`
- **THEN** CLI MUST write the component package to the selected directory
- **THEN** CLI MUST request the legacy snapshot with the same context and credential as package export
- **THEN** CLI MUST write `component-configs.json` into the selected directory

### Requirement: CLI components import-api command

CLI `dsbuilder` SHALL предоставлять команду `components import-api`, заводящую компоненты, свойства, состояния и платформенные имена в глобальном слое DS Builder по файлу API-меты платформы. Команда MUST быть доступна только системному администратору и MUST NOT зависеть от проекта или дизайн-системы.

#### Scenario: Команда не использует project context

- **WHEN** разработчик запускает `dsbuilder components import-api` в любой директории
- **THEN** CLI MUST NOT искать `.sdds/config.json` и MUST NOT требовать `projectId` или `designSystemId`
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Help не требует ничего

- **WHEN** разработчик запускает `dsbuilder components import-api --help`
- **THEN** CLI MUST показать deterministic help
- **THEN** CLI MUST NOT требовать backend, credential, файл или private URL

#### Scenario: Команда не требует plasma-android и Gradle

- **WHEN** команда запущена
- **THEN** CLI MUST NOT запускать Gradle и платформенные инструменты
- **THEN** CLI MUST NOT требовать рабочей копии plasma-android, `jq` или `curl`

### Requirement: API meta import platform

Команда SHALL требовать платформу опцией `--platform` и поддерживать платформы `compose` и `android-view`.

#### Scenario: Платформа обязательна

- **WHEN** `--platform` не указан
- **THEN** CLI MUST завершиться ошибкой использования до чтения файла и обращения к backend

#### Scenario: Платформа android-view

- **WHEN** платформа — `android-view`
- **THEN** CLI MUST нормализовать мету View и отправить её одним запросом
- **THEN** CLI MUST передать backend `platform` со значением `xml`

#### Scenario: Неподдержанная платформа

- **WHEN** платформа — `swiftui` или `react`
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что платформа пока не поддержана
- **THEN** CLI MUST NOT читать файл и MUST NOT обращаться к backend

#### Scenario: Соответствие платформы значению backend

- **WHEN** CLI формирует запрос
- **THEN** он MUST передать `compose` для `compose`, `xml` для `android-view`, `ios` для `swiftui`, `web` для `react`

### Requirement: API meta normalization

CLI SHALL преобразовывать API-мету Compose в манифест по фиксированным правилам до отправки.

#### Scenario: Дублирующиеся параметры сводятся

- **WHEN** один `id` повторяется у компонента, потому что билдер принимает слот в нескольких перегрузках
- **THEN** манифест MUST содержать одно свойство `(component, id)`
- **THEN** описание свойства MUST NOT содержать `group`

#### Scenario: Описание свойства

- **WHEN** у параметра заданы `methodName` и `paramSimpleType`
- **THEN** описание MUST иметь вид `method: <methodName>; param: <paramSimpleType>`

#### Scenario: Описание свойства с несколькими типами параметра

- **WHEN** один `id` встречается несколько раз с разными `paramSimpleType`
- **THEN** описание MUST перечислять все встреченные типы через `/` в порядке появления, без повторов
- **THEN** описание MUST NOT содержать `group`

#### Scenario: Платформенное имя

- **WHEN** платформа — `compose`
- **THEN** `platformName` свойства MUST быть равен `id`

#### Scenario: Состояния компонента

- **WHEN** компонент содержит `stateEnum.values`
- **THEN** имя состояния MUST быть `configName`, если оно задано, иначе `name` в kebab-case нижнего регистра
- **THEN** манифест MUST NOT содержать повторяющихся состояний одного компонента

#### Scenario: Подмена типа

- **WHEN** передан `--map-type from:to`
- **THEN** CLI MUST заменить тип `from` на `to` до отправки

### Requirement: API meta import is dry run by default

Команда SHALL по умолчанию выполнять dry run и записывать данные только с `--apply`, требовать явный backend API URL и печатать цель запроса до отправки.

#### Scenario: Dry run по умолчанию

- **WHEN** команда запущена без `--apply`
- **THEN** CLI MUST отправить запрос с `dryRun: true`
- **THEN** CLI MUST сообщить, что изменения не применены

#### Scenario: Конфликт режимов

- **WHEN** указаны `--apply` и `--dry-run` вместе
- **THEN** CLI MUST завершиться ошибкой использования до какого-либо чтения файла или запроса

#### Scenario: Явный API URL

- **WHEN** ни `--api-url`, ни `DSBUILDER_API_URL` не заданы
- **THEN** CLI MUST отказать и MUST NOT использовать публичное умолчание для записи

#### Scenario: Печать цели

- **WHEN** манифест готов
- **THEN** CLI MUST напечатать API URL и его источник, платформу, путь файла меты, число компонентов, свойств и состояний до отправки
- **THEN** CLI MUST NOT печатать `projectId` и `designSystemId`

### Requirement: API meta import backend contract

CLI SHALL отправлять весь манифест одним запросом на административный маршрут `import-api-meta`.

#### Scenario: Один запрос

- **WHEN** манифест готов
- **THEN** CLI MUST отправить `POST /api/admin/component-config/import-api-meta`
- **THEN** тело MUST содержать `platform`, метаданные источника, `dryRun` и все компоненты
- **THEN** тело MUST NOT содержать `designSystemId`
- **THEN** CLI MUST NOT отправлять по запросу на компонент или свойство

#### Scenario: Источник — имя файла

- **WHEN** CLI формирует метаданные источника
- **THEN** он MUST передать имя файла без директорий

#### Scenario: Печать отчёта

- **WHEN** backend вернул успешный ответ
- **THEN** CLI MUST напечатать счётчики созданных компонентов, свойств, состояний и платформенных имён и число неизменённых свойств
- **THEN** CLI MUST NOT печатать строку о привязках к дизайн-системе
- **THEN** CLI MUST напечатать `rejected` и `typeMismatches`, если они не пусты, каждый с причиной

#### Scenario: Строгий режим

- **WHEN** передан `--strict` и `rejected` не пуст
- **THEN** CLI MUST завершиться кодом `1`

#### Scenario: Ошибка backend

- **WHEN** backend вернул неуспешный статус
- **THEN** CLI MUST обработать его общим HTTP error handling CLI core
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Отчёт не разбирается

- **WHEN** backend вернул успех с телом, которое не разбирается как отчёт
- **THEN** CLI MUST вернуть deterministic failure и MUST NOT печатать частичный отчёт

### Requirement: API meta normalization of Android View

CLI SHALL преобразовывать API-мету View в тот же манифест, что и мету Compose, по фиксированным правилам до отправки. Нормализатор MUST читать мету в форме, которую оставляет плагин `dsBuilder`: поля со значениями по умолчанию в ней могут отсутствовать.

#### Scenario: Запись с несколькими именами разворачивается

- **WHEN** запись содержит несколько `componentNames`
- **THEN** манифест MUST содержать каждый из этих компонентов
- **THEN** параметры записи MUST быть у каждого из них

#### Scenario: Записи одного компонента сливаются

- **WHEN** один компонент описан в нескольких записях
- **THEN** манифест MUST содержать одно свойство на каждую пару `(component, id)`
- **THEN** при противоречии типа MUST побеждать первое вхождение, а противоречие MUST быть передано в результат нормализации

#### Scenario: Параметры без темизируемого значения пропускаются

- **WHEN** параметр имеет тип `unknown`
- **THEN** манифест MUST NOT содержать это свойство
- **THEN** пропуск MUST учитываться в сводке пропущенного

#### Scenario: Записи вложенных стилей пропускаются

- **WHEN** запись содержит `subStyle`
- **THEN** манифест MUST NOT содержать её параметры
- **THEN** пропуск MUST учитываться в сводке пропущенного

#### Scenario: Платформенные имена из атрибутов

- **WHEN** у свойства один или несколько `attrName` (после слияния записей)
- **THEN** `platformNames` свойства MUST содержать все `attrName` в порядке появления без повторов

#### Scenario: Описание свойства View

- **WHEN** свойство получено из меты View
- **THEN** описание MUST иметь вид `attr: <attrName>`
- **THEN** при нескольких `attrName` описание MUST перечислять их через `/`
- **THEN** описание MUST NOT содержать полей меты, которых у View нет (`method`, `param`)

#### Scenario: Состояния из наборов состояний

- **WHEN** запись содержит `stateSets`
- **THEN** состояниями компонента MUST быть `configName` состояний наборов, уникальные в пределах компонента
- **THEN** `stateValues` параметров и `sharedStates` MUST NOT становиться состояниями компонента

#### Scenario: Подмена типа

- **WHEN** передан `--map-type from:to`
- **THEN** CLI MUST заменить тип `from` на `to` до отправки

#### Scenario: Пустая мета

- **WHEN** мета не содержит ни одного компонента с параметрами
- **THEN** нормализатор MUST сообщить, что мета пуста, и манифест MUST NOT быть построен

### Requirement: API meta import reports skipped entries

CLI SHALL сообщать, что нормализатор пропустил, и MUST NOT скрывать пропуски.

#### Scenario: Сводка пропущенного

- **WHEN** нормализатор пропустил параметры или записи
- **THEN** CLI MUST напечатать после отчёта одну строку на каждую категорию пропусков с числом пропущенных элементов
- **THEN** пропущенное MUST NOT попадать в `rejected` backend

#### Scenario: Нет пропусков

- **WHEN** нормализатор ничего не пропустил
- **THEN** CLI MUST NOT печатать сводку пропущенного

### Requirement: API meta import reads the meta from a file

CLI SHALL читать API-мету из локального файла, путь которого задан обязательной опцией `--from`, и MUST NOT получать её через платформенные инструменты.

#### Scenario: Файл из --from

- **WHEN** задан `--from <путь>`
- **THEN** CLI MUST прочитать файл по этому пути; относительный путь MUST быть приведён к абсолютному относительно текущей директории

#### Scenario: Оба вида файла

- **WHEN** файл — сырой вывод генератора меты либо вывод плагина `dsBuilder` с опущенными значениями по умолчанию
- **THEN** CLI MUST нормализовать оба вида одинаково

#### Scenario: --from обязателен

- **WHEN** `--from` не указан
- **THEN** CLI MUST завершиться ошибкой использования до обращения к backend

#### Scenario: Файл не найден

- **WHEN** файл по `--from` отсутствует или не читается
- **THEN** CLI MUST завершиться ненулевым кодом, назвать путь и MUST NOT обращаться к backend

#### Scenario: Файл пуст

- **WHEN** файл не содержит ни одного компонента с параметрами
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что мета пуста, и назвать путь
- **THEN** CLI MUST NOT отправлять запрос на backend

#### Scenario: Файл другой платформы

- **WHEN** содержимое файла не соответствует формату выбранной платформы
- **THEN** CLI MUST завершиться ненулевым кодом, назвать файл и причину
- **THEN** CLI MUST NOT отправлять запрос на backend

#### Scenario: Опции удалённого способа не принимаются

- **WHEN** команда запущена с `--tool` или `--api-key`
- **THEN** CLI MUST завершиться ошибкой использования

### Requirement: API meta import requires a user session

CLI SHALL выполнять запрос только с user session и MUST NOT использовать ключи проекта для этой команды.

#### Scenario: User session

- **WHEN** для указанного API URL сохранена user session
- **THEN** CLI MUST отправить запрос с токеном пользователя (`Authorization: Bearer`)

#### Scenario: Ключ проекта игнорируется

- **WHEN** в окружении задан ключ проекта
- **THEN** CLI MUST NOT использовать его для этой команды

#### Scenario: Нет user session

- **WHEN** для указанного API URL нет user session
- **THEN** CLI MUST завершиться ненулевым кодом с указанием выполнить `dsbuilder auth login` для этого API URL
- **THEN** CLI MUST NOT отправлять запрос на backend

#### Scenario: Роль проверяет сервер

- **WHEN** пользователь не системный администратор
- **THEN** CLI MUST показать отказ backend с его причиной и завершиться ненулевым кодом
- **THEN** CLI MUST NOT проверять роль самостоятельно до запроса


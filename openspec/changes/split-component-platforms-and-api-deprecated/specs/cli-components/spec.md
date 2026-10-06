## MODIFIED Requirements

### Requirement: Components push backend contract

CLI `components push` SHALL upload the whole package in a single request to the component-config import endpoint, addressing the design system by `designSystemId` and the component platform by `platform` in the request body.

#### Scenario: Push отправляет один запрос

- **WHEN** CLI has converted the package
- **THEN** CLI MUST send `POST /api/projects/{projectId}/ds/component-config/import`
- **THEN** the request body MUST contain `designSystemId` taken from the project config
- **THEN** the request body MUST contain `platform` resolved from the project config
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

### Requirement: Components fetch backend contract

CLI `components fetch` SHALL download the whole package in a single request to the component-config
export endpoint, addressing the design system by `designSystemId` and the component platform by `platform` in the request body.

#### Scenario: Fetch отправляет один запрос

- **WHEN** CLI performs a fetch
- **THEN** CLI MUST send `POST /api/projects/{projectId}/ds/component-config/export`
- **THEN** the request body MUST contain `designSystemId` taken from the project config
- **THEN** the request body MUST contain `platform` resolved from the project config
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

#### Scenario: Платформенные имена с устареванием

- **WHEN** CLI формирует свойство манифеста
- **THEN** каждый элемент `platformNames` MUST быть объектом `{ name }` и MUST содержать `deprecated: { message }` только если соответствующая запись меты помечена как устаревшая

#### Scenario: Печать отчёта

- **WHEN** backend вернул успешный ответ
- **THEN** CLI MUST напечатать счётчики созданных компонентов, свойств, состояний и платформенных имён и число неизменённых свойств
- **THEN** CLI MUST напечатать счётчики `deprecatedMarked`, `deprecatedMessageChanged` и `deprecatedCleared`, если хотя бы один из них не равен нулю
- **THEN** CLI MUST NOT печатать строку о привязках к дизайн-системе
- **THEN** CLI MUST напечатать `rejected` и `typeMismatches`, если они не пусты, каждый с причиной
- **THEN** CLI MUST напечатать справочный раздел `Absent from meta` со списком `absent`, если он не пуст

#### Scenario: Строгий режим

- **WHEN** передан `--strict` и `rejected` не пуст
- **THEN** CLI MUST завершиться кодом `1`
- **THEN** непустой `absent` и ненулевые счётчики `deprecated*` MUST NOT влиять на код выхода

#### Scenario: Ошибка backend

- **WHEN** backend вернул неуспешный статус
- **THEN** CLI MUST обработать его общим HTTP error handling CLI core
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Отчёт не разбирается

- **WHEN** backend вернул успех с телом, которое не разбирается как отчёт
- **THEN** CLI MUST вернуть deterministic failure и MUST NOT печатать частичный отчёт

## ADDED Requirements

### Requirement: Components commands resolve the platform from the project config

CLI `components push` и `components fetch` SHALL определять платформу компонентов по `platforms` из `.sdds/config.json` и передавать её backend значением словаря backend (`compose` для `compose`, `xml` для `android-view`, `ios` для `swiftui`, `web` для `react`). Если в конфигурации одна платформа, CLI MUST использовать её; если несколько, опция `--platform` MUST быть обязательной. Опция `--platform` MUST переопределять конфигурацию.

#### Scenario: Одна платформа в конфигурации

- **WHEN** `platforms` содержит одну платформу
- **THEN** CLI MUST передать её backend без дополнительных опций

#### Scenario: Несколько платформ

- **WHEN** `platforms` содержит несколько платформ и `--platform` не указан
- **THEN** CLI MUST завершиться ошибкой использования, перечислив доступные платформы, до обращения к backend

#### Scenario: Явная платформа

- **WHEN** передан `--platform`
- **THEN** CLI MUST использовать указанную платформу вместо конфигурации
- **THEN** CLI MUST завершиться ошибкой, если платформы нет в словаре backend

#### Scenario: Платформа неизвестна

- **WHEN** в конфигурации нет платформ и `--platform` не указан
- **THEN** CLI MUST завершиться ошибкой использования и MUST NOT обращаться к backend

### Requirement: API meta normalization reads deprecation

Нормализаторы Compose и Android View SHALL читать поле `deprecated` свойств меты и передавать его в манифест на уровне платформенного имени. Нормализатор Compose MUST помечать устаревшим имя свойства, если устаревшим помечена хотя бы одна запись с этим `id`, и брать сообщение первой помеченной записи. Нормализатор View MUST помечать устаревшим только имя, соответствующее помеченному `attrName`, и MUST NOT распространять статус на другие `attrName` с тем же `id`. Пустое сообщение MUST сохраняться как пустая строка и MUST NOT приравниваться к отсутствию пометки. Мета без поля `deprecated` MUST разбираться без ошибки.

#### Scenario: Compose, одна перегрузка помечена

- **WHEN** две записи с одним `id`, и `deprecated` есть только у одной
- **THEN** имя свойства в манифесте MUST содержать `deprecated` с сообщением помеченной записи

#### Scenario: View, помечен один атрибут

- **WHEN** у свойства два `attrName`, и `deprecated` есть только у `sd_textColor`
- **THEN** `sd_textColor` MUST быть передан с `deprecated`, а `android:textColor` MUST быть передан без него

#### Scenario: Пустое сообщение

- **WHEN** `deprecated` имеет `message` равный пустой строке
- **THEN** имя в манифесте MUST содержать `deprecated` с пустым `message`

#### Scenario: Мета без deprecated

- **WHEN** ни одна запись меты не содержит `deprecated`
- **THEN** все имена MUST быть переданы без `deprecated`
- **THEN** разбор MUST завершиться без ошибки

#### Scenario: Слияние записей View одного компонента

- **WHEN** один `attrName` встречается в нескольких записях компонента и помечен хотя бы в одной
- **THEN** имя MUST быть передано с `deprecated` первой помеченной записи

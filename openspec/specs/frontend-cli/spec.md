# frontend-cli Specification

## Purpose
Определяет CLI приложение `dsbuilder` в `frontend-kt`: структуру Kotlin Multiplatform модуля, JVM entrypoint, базовое поведение запуска и обязательные Gradle checks.
## Requirements
### Requirement: CLI module structure
`frontend-kt` SHALL contain a Kotlin Multiplatform module `:cli` for the `dsbuilder` CLI application, and SHALL NOT include `:desktopApp` or `:shared` in the active frontend Gradle build for this change.

#### Scenario: Frontend settings include only CLI module
- **WHEN** a developer opens `frontend-kt/settings.gradle.kts`
- **THEN** the active module list includes `:cli`
- **THEN** the active module list does not include `:desktopApp` or `:shared`

#### Scenario: CLI module uses common source sets
- **WHEN** a developer inspects `frontend-kt/cli`
- **THEN** the module contains Kotlin Multiplatform source sets for shared CLI behavior and tests
- **THEN** platform-specific process entrypoint code is isolated from shared CLI behavior

### Requirement: CLI application entrypoint
The `:cli` module SHALL provide an executable JVM entrypoint for a command named `dsbuilder`.

#### Scenario: CLI entrypoint is configured
- **WHEN** Gradle configures the `:cli` module
- **THEN** the module exposes a JVM main class for launching the CLI application
- **THEN** the configured application name is `dsbuilder`

#### Scenario: CLI can print baseline output
- **WHEN** a developer runs the CLI without product-specific command implementation
- **THEN** the CLI returns deterministic baseline output suitable for smoke testing
- **THEN** the CLI does not require backend services, Docker, credentials, or private URLs

### Requirement: CLI verification
The CLI module SHALL include tests for baseline CLI behavior and SHALL be verifiable through Gradle build, test, Detekt, and Spotless tasks in `frontend-kt`.

#### Scenario: CLI tests cover baseline behavior
- **WHEN** `./gradlew test` runs inside `frontend-kt`
- **THEN** tests for baseline CLI behavior execute successfully

#### Scenario: Frontend quality tasks are available
- **WHEN** a developer runs `./gradlew build`, `./gradlew detekt`, or `./gradlew spotlessCheck` inside `frontend-kt`
- **THEN** Gradle can resolve and execute the relevant checks for the `:cli` module

### Requirement: CLI command parsing

The `dsbuilder` CLI SHALL use a Kotlin Multiplatform command parser for root command behavior, subcommands, nested subcommands, options, help output, and option errors.

#### Scenario: Root command exposes subcommands

- **WHEN** developer runs `dsbuilder --help`
- **THEN** CLI MUST show deterministic help for the root `dsbuilder` command
- **THEN** help MUST include `init`, `status`, `theme`, and `components` subcommands

#### Scenario: Theme command exposes subcommands

- **WHEN** developer runs `dsbuilder theme --help`
- **THEN** CLI MUST show deterministic help for the `theme` command
- **THEN** help MUST include `fetch` subcommand
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Components command exposes subcommands

- **WHEN** developer runs `dsbuilder components --help`
- **THEN** CLI MUST show deterministic help for the `components` command
- **THEN** help MUST include `push` and `fetch` subcommands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Required option is missing

- **WHEN** developer runs `dsbuilder init` without required options
- **THEN** CLI MUST return a deterministic option error
- **THEN** CLI MUST NOT create `.sdds/config.json`

#### Scenario: Unknown command is rejected

- **WHEN** developer runs `dsbuilder unknown-command`
- **THEN** CLI MUST return a deterministic unknown command error
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

### Requirement: CLI init command

The `dsbuilder` CLI SHALL provide an `init` command that creates local project configuration for the current directory.

#### Scenario: Init создает project config

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a`
- **THEN** CLI MUST create `.sdds/config.json` in the target directory
- **THEN** generated config MUST contain JSON field `"projectId": "project-a"`
- **THEN** generated config MUST contain JSON field `"designSystemId": "design-system-a"`
- **THEN** generated config MUST contain env credential reference `DSBUILDER_API_KEY`

#### Scenario: Init принимает custom API key env

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a --api-key-env DSBUILDER_PROJECT_A_API_KEY`
- **THEN** generated config MUST contain env credential reference `DSBUILDER_PROJECT_A_API_KEY`

#### Scenario: Init не принимает raw API key

- **WHEN** developer runs `dsbuilder init`
- **THEN** CLI MUST NOT require raw API key input
- **THEN** CLI MUST NOT write raw API key into `.sdds/config.json`
- **THEN** CLI MUST NOT write API URL into `.sdds/config.json`

#### Scenario: Init защищает существующий config

- **WHEN** `.sdds/config.json` already exists in the target directory
- **WHEN** developer runs `dsbuilder init` without an explicit overwrite option
- **THEN** CLI MUST return a deterministic error
- **THEN** CLI MUST NOT silently overwrite the existing config

### Requirement: CLI project-scoped command foundation

The `dsbuilder` CLI SHALL route project-scoped commands through shared CLI core config, credential, and HTTP behavior.

#### Scenario: Project command использует CLI core

- **WHEN** a future project-scoped command is added to `dsbuilder`
- **THEN** it MUST use CLI core to resolve `.sdds/config.json`
- **THEN** it MUST use CLI core to resolve API key credentials
- **THEN** it MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests

#### Scenario: Theme fetch использует CLI core

- **WHEN** developer runs `dsbuilder theme fetch`
- **THEN** CLI MUST resolve the nearest `.sdds/config.json` through CLI core
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests

#### Scenario: Components push использует CLI core

- **WHEN** developer runs `dsbuilder components push`
- **THEN** CLI MUST resolve the nearest `.sdds/config.json` through CLI core
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests
- **THEN** CLI MUST use CLI core to reject the code default backend API URL

#### Scenario: Components fetch использует CLI core

- **WHEN** developer runs `dsbuilder components fetch`
- **THEN** CLI MUST resolve the nearest `.sdds/config.json` through CLI core
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST use CLI core to add `Authorization: ProjectKey <api_key>` to backend requests

#### Scenario: Baseline commands остаются доступными

- **WHEN** developer runs `dsbuilder --help` or `dsbuilder --version`
- **THEN** CLI MUST continue returning deterministic baseline output
- **THEN** these baseline commands MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

### Requirement: CLI status command

The `dsbuilder` CLI SHALL provide a `status` command that verifies the configured project and design system without printing project lists or raw credentials.

#### Scenario: Status проверяет API key через configured project

- **WHEN** developer runs `dsbuilder status` inside an initialized project directory
- **THEN** CLI MUST resolve the nearest `.sdds/config.json`
- **THEN** CLI MUST resolve API key credentials through CLI core
- **THEN** CLI MUST resolve API URL through CLI core
- **THEN** CLI MUST send `GET /api/projects/{projectId}` using `projectId` from config
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}` using `projectId` and `designSystemId` from config
- **THEN** CLI MUST include `Authorization: ProjectKey <api_key>`

#### Scenario: Status показывает только результат проверки

- **WHEN** backend returns success for `dsbuilder status`
- **THEN** CLI MUST print a deterministic authorized status
- **THEN** CLI MUST print project `name` from project response
- **THEN** CLI MUST print design system `name` from design system response
- **THEN** CLI MUST NOT print the project list
- **THEN** CLI MUST NOT print the raw API key

#### Scenario: Status сообщает об ошибке авторизации

- **WHEN** backend returns `401`, `403`, or `404` for `dsbuilder status`
- **THEN** CLI MUST map the response through common CLI core HTTP error handling
- **THEN** CLI MUST print a deterministic failure message without raw API key values

#### Scenario: Status не использует user-scoped project list

- **WHEN** developer runs `dsbuilder status`
- **THEN** CLI MUST NOT call `GET /api/projects` for API key validation
- **THEN** CLI MUST validate only the project configured in `.sdds/config.json`

### Requirement: CLI feature backend integration boundary

Use case фичи CLI SHALL обращаться к backend API только через port-интерфейс, объявленный в пакете `application` фичи и реализованный в её пакете `data`. Use case MUST NOT зависеть от HTTP client, пути запроса, конфигурации JSON и wire-моделей запроса и ответа. Presentation MUST получать доменные модели, а не DTO backend.

#### Scenario: Use case не работает с HTTP напрямую

- **WHEN** разработчик открывает use case фичи CLI, обращающейся к backend
- **THEN** use case MUST принимать port-интерфейс из пакета `application` фичи
- **THEN** use case MUST NOT принимать `AuthenticatedHttpClientFactory` или создавать HTTP client
- **THEN** use case MUST NOT содержать путь backend-запроса, конфигурацию `Json` и вызовы сериализации

#### Scenario: Wire-формат живёт в data

- **WHEN** разработчик открывает реализацию port-интерфейса в пакете `data` фичи
- **THEN** `@Serializable` модели тела запроса и ответа MUST быть объявлены в `data`
- **THEN** путь backend-запроса и разбор ответа MUST выполняться в `data`
- **THEN** реализация MUST возвращать доменные модели или result-типы порта, а не wire-DTO

#### Scenario: Presentation не рендерит DTO backend

- **WHEN** presentation фичи печатает результат backend-операции
- **THEN** presentation MUST рендерить доменную модель результата
- **THEN** presentation MUST NOT импортировать `@Serializable` модель ответа backend

#### Scenario: Components push обращается к backend через port

- **WHEN** выполняется `dsbuilder components push`
- **THEN** use case MUST отправлять пакет через port-интерфейс component-config remote source
- **THEN** реализация порта в `data` MUST выполнять `POST /api/projects/{projectId}/ds/component-config/import` через CLI core authenticated HTTP client
- **THEN** отчёт импорта MUST приходить в use case доменной моделью

#### Scenario: Components fetch обращается к backend через тот же port

- **WHEN** выполняется `dsbuilder components fetch`
- **THEN** use case MUST запрашивать пакет через тот же port-интерфейс component-config remote source
- **THEN** реализация порта в `data` MUST выполнять `POST /api/projects/{projectId}/ds/component-config/export` через CLI core authenticated HTTP client
- **THEN** выгруженный пакет MUST приходить в use case доменной моделью
- **THEN** use case MUST NOT импортировать `@Serializable` модель ответа export

#### Scenario: Проверки разнесены по слоям

- **WHEN** выполняются тесты фичи CLI, обращающейся к backend
- **THEN** wire-контракт (путь, состав тела, разбор ответа, нечитаемый ответ) MUST проверяться тестами реализации порта в `data`
- **THEN** тест use case MUST использовать fake порта и проверять оркестрацию, а не форму JSON

### Requirement: CLI feature local write boundary

Фича CLI, пишущая в рабочую копию, SHALL решать, что и куда писать, в пакете `domain` через
построитель плана записи, и обращаться к файловой системе только через port-интерфейс,
объявленный в `application` и реализованный в `data`.

#### Scenario: План записи строится в domain

- **WHEN** фича CLI собирается записать файлы в рабочую копию
- **THEN** состав файлов, их имена, порядок записей и содержимое MUST определяться построителем плана в пакете `domain`
- **THEN** построитель плана MUST NOT обращаться к файловой системе
- **THEN** построитель плана MUST возвращать либо план, либо deterministic отказ

#### Scenario: Файловая система живёт за портом

- **WHEN** разработчик открывает use case пишущей фичи CLI
- **THEN** use case MUST получать чтение и запись файлов через port-интерфейсы из `application`
- **THEN** реализации портов MUST лежать в `data` и использовать `CliFileSystem`
- **THEN** реализация записи MUST выполнять план и MUST NOT принимать решений о составе и именах файлов

#### Scenario: Отказ обнаруживается до записи

- **WHEN** построитель плана возвращает отказ
- **THEN** use case MUST вернуть deterministic сообщение
- **THEN** ни один файл MUST NOT быть записан

#### Scenario: Проверки записи разнесены по слоям

- **WHEN** выполняются тесты пишущей фичи CLI
- **THEN** политика имён, обнаружение коллизий, порядок и состав плана MUST проверяться тестами построителя на доменных моделях, без файловой системы
- **THEN** тест use case MUST использовать fake портов чтения и записи


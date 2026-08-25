## MODIFIED Requirements

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

## ADDED Requirements

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

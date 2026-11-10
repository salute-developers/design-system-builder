# frontend-cli Specification

## Purpose
Определяет CLI приложение `dsbuilder` в `frontend-kt`: структуру Kotlin Multiplatform модуля, JVM entrypoint, базовое поведение запуска и обязательные Gradle checks.

## Requirements

### Requirement: CLI module structure

`frontend-kt` SHALL содержать Kotlin Multiplatform приложение `:cli`, общие `core-*`/`feature-*` библиотеки, новый
`feature-auth` и MCP-модули `mcp-server-core`/`mcp-node`. `:cli` SHALL оставаться presentation/composition root и SHALL
запускать общий MCP server in-process.

#### Scenario: Frontend settings include the CLI module and the core/feature library modules

- **WHEN** a developer opens `frontend-kt/settings.gradle.kts`
- **THEN** the active module list includes `:cli`, `:core-domain`, `:core-network`, `:core-auth`, `:core-workspace`, `:core-application`, `:feature-theme`, `:feature-docs`, `:feature-components`, `:feature-init`, and `:feature-status`
- **THEN** the active module list does not include `:desktopApp` or `:shared`

#### Scenario: CLI module contains only presentation and the composition root

- **WHEN** a developer inspects `frontend-kt/cli`
- **THEN** the module contains only `*CliCommand` presentation classes, CLI-specific Koin presentation wiring, and the platform composition root (runtime wiring for JVM and macOS targets)
- **THEN** the module does not contain use case, domain, or data-adapter source code for any CLI feature
- **THEN** platform-specific process entrypoint code remains isolated from presentation source sets

#### Scenario: Frontend settings включают auth и MCP модули

- **WHEN** разработчик открывает `frontend-kt/settings.gradle.kts`
- **THEN** active module list MUST включать `:feature-auth`, `:mcp-server-core` и `:mcp-node` вместе с существующими
  `:cli`, `core-*` и `feature-*`

#### Scenario: CLI остается тонким presentation-слоем

- **WHEN** разработчик инспектирует `frontend-kt/cli`
- **THEN** модуль MUST содержать только CLI presentation, DI/composition root и platform launcher adapters
- **THEN** login/refresh/session и MCP tool business logic MUST находиться в общих модулях

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

`dsbuilder` CLI SHALL предоставлять существующие product commands, пользовательские `auth` subcommands и локальный
`mcp serve` launcher через Kotlin Multiplatform command parser.

#### Scenario: Root command exposes subcommands

- **WHEN** developer runs `dsbuilder --help`
- **THEN** CLI MUST show deterministic help for the root `dsbuilder` command
- **THEN** help MUST include `init`, `status`, `theme`, `components`, `docs`, and `toolchain` subcommands

#### Scenario: Theme command exposes subcommands

- **WHEN** developer runs `dsbuilder theme --help`
- **THEN** CLI MUST show deterministic help for the `theme` command
- **THEN** help MUST include `fetch` and `generate` subcommands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Components command exposes subcommands

- **WHEN** developer runs `dsbuilder components --help`
- **THEN** CLI MUST show deterministic help for the `components` command
- **THEN** help MUST include `push`, `fetch` and `generate` subcommands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Toolchain command exposes subcommands

- **WHEN** developer runs `dsbuilder toolchain --help`
- **THEN** CLI MUST show deterministic help for the `toolchain` command
- **THEN** help MUST include `list` and `doctor` subcommands
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Required option is missing

- **WHEN** разработчик запускает `dsbuilder init` с недостающими ID без интерактивного терминала
- **THEN** CLI MUST вернуть детерминированную ошибку с именами недостающих параметров без ожидания ввода
- **THEN** CLI MUST NOT create `.sdds/config.json`

#### Scenario: Unknown command is rejected

- **WHEN** developer runs `dsbuilder unknown-command`
- **THEN** CLI MUST return a deterministic unknown command error
- **THEN** CLI MUST NOT require `.sdds/config.json`, backend services, Docker, credentials, or private URLs

#### Scenario: Root command показывает новые группы

- **WHEN** пользователь запускает `dsbuilder --help`
- **THEN** help MUST включать `auth` и `mcp` вместе с существующими subcommands
- **THEN** help MUST NOT требовать `.sdds`, backend или credentials

#### Scenario: MCP command показывает serve

- **WHEN** пользователь запускает `dsbuilder mcp --help`
- **THEN** help MUST включать `serve`
- **THEN** help MUST описывать `--api-url` и `--workspace` без запуска MCP server

#### Scenario: Auth command показывает lifecycle commands

- **WHEN** пользователь запускает `dsbuilder auth --help`
- **THEN** help MUST включать `login`, `status` и `logout`
- **THEN** help MUST NOT читать password или обращаться к backend

### Requirement: CLI init command

The `dsbuilder` CLI SHALL provide an `init` command that creates local project configuration for the current directory.

#### Scenario: Init создает project config

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a`
- **THEN** CLI MUST create `.sdds/config.json` in the target directory
- **THEN** generated config MUST contain JSON field `"projectId": "project-a"`
- **THEN** generated config MUST contain JSON field `"designSystemId": "design-system-a"`
- **THEN** generated config MUST contain credential.type = auto и env credential reference `DSBUILDER_API_KEY`

#### Scenario: Init принимает custom API key env

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a --api-key-env PROJECT_A_PAT`
- **THEN** generated config MUST contain credential.type = auto и env credential reference `PROJECT_A_PAT`

#### Scenario: Init принимает целевые платформы

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a --platform swiftui`
- **THEN** generated config MUST contain JSON array field `platforms` with value `["swiftui"]`
- **WHEN** the option is repeated for several platforms
- **THEN** generated config MUST contain every listed platform in the order they were given

#### Scenario: Init не принимает raw API key

- **WHEN** developer runs `dsbuilder init`
- **THEN** CLI MUST NOT require секрет PAT input
- **THEN** CLI MUST NOT write секрет PAT into `.sdds/config.json`
- **THEN** CLI MUST NOT write API URL into `.sdds/config.json`

#### Scenario: Init защищает существующий config

- **WHEN** `.sdds/config.json` already exists in the target directory
- **WHEN** developer runs `dsbuilder init` without an explicit overwrite option
- **THEN** CLI MUST return a deterministic error
- **THEN** CLI MUST NOT silently overwrite the existing config

#### Scenario: Интерактивный выбор
- **WHEN** пользователь запускает `dsbuilder init` в терминале без одного или обоих ID
- **THEN** CLI MUST получить доступные проекты и системы через общий выбор PAT/OAuth и сначала предложить меню проектов, затем загрузить и показать меню систем только выбранного проекта с именем, ID и описанием при наличии
- **THEN** стрелки ↑/↓ MUST перемещать выделение, Enter MUST подтверждать вариант без ввода названий и ID
- **THEN** длинный список MUST поддерживать прокрутку, единственный вариант MUST подтверждаться Enter
- **THEN** явно переданный ID MUST пропустить соответствующий вопрос
- **THEN** после выбора системы CLI MUST предложить необязательный множественный выбор платформ: ↑/↓ перемещают курсор, Space включает или выключает платформу, Enter сохраняет выбранные платформы, включая пустой список
- **THEN** если передан хотя бы один `--platform`, CLI MUST пропустить меню платформ и сохранить явно переданные значения
- **THEN** созданная конфигурация MUST использовать `credential.type = "auto"` и имя DSBUILDER_API_KEY либо явно заданное --api-key-env независимо от интерактивного режима
- **THEN** версия MUST NOT требоваться для локальной конфигурации

#### Scenario: Нет доступного выбора или ввод отменён
- **WHEN** список проектов или систем пуст, пользователь нажимает Ctrl+C либо закрывает stdin на любом шаге
- **THEN** CLI MUST завершиться без создания конфигурации с понятным сообщением
- **THEN** режим терминала и видимость курсора MUST восстанавливаться после завершения, отмены и ошибки
- **WHEN** терминал не поддерживает интерактивное меню
- **THEN** CLI MUST сообщить о необходимости передать явные ID без ожидания ввода

#### Scenario: Сессия отсутствует
- **WHEN** для интерактивного выбора не найден PAT и нет действующей пользовательской сессии
- **THEN** CLI MUST предложить выполнить `dsbuilder auth login` без скрытого запуска входа и без записи конфигурации

#### Scenario: Совместимый явный режим
- **WHEN** переданы оба ID и нет интерактивного выбора
- **THEN** CLI MUST сохранить существующее создание конфигурации без сетевых запросов и с env-ссылкой на API key
- **THEN** существующий `--platform` MUST сохранять прежнее поведение

### Requirement: CLI project-scoped command foundation

Project-scoped CLI commands SHALL использовать общие context, API URL и credential services; выбор credential SHALL соответствовать локальной policy или headless policy, не меняя actor после backend authorization failure.

#### Scenario: Project command использует CLI core

- **WHEN** новая project-scoped команда добавлена в `dsbuilder`
- **THEN** она MUST разрешать локальный или явный контекст через CLI core
- **THEN** она MUST разрешать credential через общий provider
- **THEN** её HTTP adapter MUST отправлять `Authorization: Bearer <PAT>` либо `Authorization: Bearer <OAuth access token>` согласно выбранному типу учётных данных

#### Scenario: Theme fetch использует CLI core

- **WHEN** разработчик запускает `dsbuilder theme fetch`
- **THEN** CLI MUST разрешить контекст, API URL и выбранный credential через CLI core
- **THEN** CLI MUST передать выбранный credential во все backend-запросы команды

#### Scenario: Components push использует CLI core

- **WHEN** разработчик запускает `dsbuilder components push`
- **THEN** CLI MUST разрешить контекст и выбранный credential через CLI core
- **THEN** CLI MUST отклонить backend API URL, полученный из code default

#### Scenario: Components fetch использует CLI core

- **WHEN** разработчик запускает `dsbuilder components fetch`
- **THEN** CLI MUST разрешить контекст и выбранный credential через CLI core
- **THEN** CLI MUST передать выбранный credential в backend-запрос

#### Scenario: Baseline commands остаются доступными

- **WHEN** разработчик запускает `dsbuilder --help` или `dsbuilder --version`
- **THEN** CLI MUST вернуть deterministic baseline output
- **THEN** эти команды MUST NOT требовать `.sdds/config.json`, backend, credential или private URL

#### Scenario: Project key отсутствует, но user session доступна

- **WHEN** локальная policy `auto` не находит PAT и для resolved API URL доступна user session
- **THEN** команда MUST выполнить backend request с Bearer access token

#### Scenario: Project key найден, но отклонен

- **WHEN** backend отвечает `401` или `403` для выбранного PAT
- **THEN** команда MUST вернуть соответствующую ошибку
- **THEN** команда MUST NOT повторять запрос от другого actor

### Requirement: CLI status command

The `dsbuilder` CLI SHALL provide a `status` command that verifies the configured project and design system without printing project lists or raw credentials.

#### Scenario: Status проверяет API key через configured project

- **WHEN** developer runs `dsbuilder status` inside an initialized project directory
- **THEN** CLI MUST resolve the nearest `.sdds/config.json`
- **THEN** CLI MUST выбирать PAT или OAuth-сессию через общий provider
- **THEN** CLI MUST resolve API URL through CLI core
- **THEN** CLI MUST send `GET /api/projects/{projectId}` using `projectId` from config
- **THEN** CLI MUST send `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}` using `projectId` and `designSystemId` from config
- **THEN** CLI MUST передать `Authorization: Bearer <PAT>` или Bearer OAuth access token согласно выбранному типу учётных данных

#### Scenario: Status показывает только результат проверки

- **WHEN** backend returns success for `dsbuilder status`
- **THEN** CLI MUST print a deterministic authorized status
- **THEN** CLI MUST print project `name` from project response
- **THEN** CLI MUST print design system `name` from design system response
- **THEN** CLI MUST NOT print the project list
- **THEN** CLI MUST NOT print the секрет PAT

#### Scenario: Status сообщает об ошибке авторизации

- **WHEN** backend returns `401`, `403`, or `404` for `dsbuilder status`
- **THEN** CLI MUST map the response through common CLI core HTTP error handling
- **THEN** CLI MUST print a deterministic failure message without секрет PAT values

#### Scenario: Status не использует user-scoped project list

- **WHEN** developer runs `dsbuilder status`
- **THEN** CLI MUST NOT call `GET /api/projects` for проверки авторизации
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

### Requirement: Явная дизайн-система для project-scoped CLI команд

Project-scoped CLI команды SHALL принимать `--design-system <uri>` там, где удалённая цель может быть задана без локального `.sdds`; локальные исходники и артефакты по-прежнему SHALL задаваться отдельными путями.

#### Scenario: Команда запущена вне initialized directory

- **WHEN** пользователь передаёт корректный `--design-system` из директории без `.sdds`
- **THEN** CLI MUST использовать выбранные project/design-system/version/platform; read-only команды MUST NOT создавать `.sdds`
- **THEN** CLI MUST запросить credential согласно headless policy

#### Scenario: Команде необходим локальный archive

- **WHEN** `docs publish` получает `--design-system`, но не может найти указанный локальный bundle
- **THEN** CLI MUST сообщить об отсутствии bundle
- **THEN** URI MUST NOT интерпретироваться как путь к локальному файлу

### Requirement: Нативный выпуск CLI для Windows x64

`:cli` SHALL предоставлять исполняемый файл `dsbuilder.exe` для Windows x64, запускаемый без установленной Java, Node.js или Gradle.

#### Scenario: Базовые команды на чистой Windows

- **WHEN** пользователь распаковывает выпуск Windows x64 и запускает `dsbuilder.exe --help` или `dsbuilder.exe --version`
- **THEN** команда MUST завершиться с ожидаемым кодом и детерминированным выводом
- **THEN** для запуска MUST NOT требоваться Java, Node.js, Gradle, Docker, учётные данные или сервер DS Builder

#### Scenario: Установка из выпуска

- **WHEN** пользователь выполняет приложенный сценарий установки Windows
- **THEN** `dsbuilder.exe` MUST копироваться в каталог пользователя без административных прав
- **THEN** инструкция MUST объяснять, как добавить этот каталог в `PATH` и как вызвать `dsbuilder.exe mcp serve` из MCP-клиента

#### Scenario: Существующие команды не теряются

- **WHEN** пользователь запускает `dsbuilder.exe --help`
- **THEN** набор команд MUST включать те же группы, что и нативный выпуск macOS, включая `auth` и `mcp`
- **THEN** команды, которым нужен внешний платформенный инструмент, MUST сообщать о его отсутствии или недоступности без требования Java для запуска самого CLI

### Requirement: Восстановление Windows-консоли после интерактивного выбора

Интерактивный мастер на Windows SHALL сохранять исходные режимы консоли до открытия меню и восстанавливать их при любом завершении. Ограничения терминальной библиотеки SHALL NOT оставлять консоль в изменённом режиме.

#### Scenario: Подтверждение выбора
- **WHEN** пользователь выбирает проект и его дизайн-систему стрелками и Enter на Windows
- **THEN** мастер MUST использовать ID выбранных объектов без ручного ввода
- **THEN** после завершения режимы консоли MUST совпадать с исходными, а видимость курсора MUST быть восстановлена
- **THEN** последующий ввод в той же консоли MUST работать как до запуска мастера

#### Scenario: Отмена или ошибка
- **WHEN** мастер на Windows завершён через Ctrl+C, закрытие входа либо ошибку после открытия меню
- **THEN** исходные режимы консоли и видимость курсора MUST быть восстановлены
- **THEN** незавершённый выбор MUST NOT создавать локальную конфигурацию

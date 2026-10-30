## MODIFIED Requirements

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
- **THEN** generated config MUST contain env credential reference `DSBUILDER_API_KEY`

#### Scenario: Init принимает custom API key env

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a --api-key-env DSBUILDER_PROJECT_A_API_KEY`
- **THEN** generated config MUST contain env credential reference `DSBUILDER_PROJECT_A_API_KEY`

#### Scenario: Init принимает целевые платформы

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id design-system-a --platform swiftui`
- **THEN** generated config MUST contain JSON array field `platforms` with value `["swiftui"]`
- **WHEN** the option is repeated for several platforms
- **THEN** generated config MUST contain every listed platform in the order they were given

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

#### Scenario: Интерактивный выбор
- **WHEN** пользователь запускает `dsbuilder init` в терминале без одного или обоих ID
- **THEN** CLI MUST получить доступные проекты и системы через пользовательскую сессию и сначала предложить меню проектов, затем загрузить и показать меню систем только выбранного проекта с именем, ID и описанием при наличии
- **THEN** стрелки ↑/↓ MUST перемещать выделение, Enter MUST подтверждать вариант без ввода названий и ID
- **THEN** длинный список MUST поддерживать прокрутку, единственный вариант MUST подтверждаться Enter
- **THEN** явно переданный ID MUST пропустить соответствующий вопрос
- **THEN** созданная конфигурация MUST использовать `credential.type = "user-session"`, если `--api-key-env` не задан явно
- **THEN** версия MUST NOT требоваться для локальной конфигурации

#### Scenario: Нет доступного выбора или ввод отменён
- **WHEN** список проектов или систем пуст, пользователь нажимает Ctrl+C либо закрывает stdin
- **THEN** CLI MUST завершиться без создания конфигурации с понятным сообщением
- **THEN** режим терминала и видимость курсора MUST восстанавливаться после завершения, отмены и ошибки
- **WHEN** терминал не поддерживает интерактивное меню
- **THEN** CLI MUST сообщить о необходимости передать явные ID без ожидания ввода

#### Scenario: Сессия отсутствует
- **WHEN** для интерактивного выбора нет действующей пользовательской сессии
- **THEN** CLI MUST предложить выполнить `dsbuilder auth login` без скрытого запуска входа и без записи конфигурации

#### Scenario: Совместимый явный режим
- **WHEN** переданы оба ID и нет интерактивного выбора
- **THEN** CLI MUST сохранить существующее создание конфигурации без сетевых запросов и с env-ссылкой на API key
- **THEN** существующий `--platform` MUST сохранять прежнее поведение


## ADDED Requirements

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

#### Scenario: Проверка на целевой платформе
- **WHEN** проверяется готовность интерактивного мастера Windows
- **THEN** выбор стрелками/Enter, отмена и восстановление консоли MUST быть проверены на Windows
- **THEN** успешная кросс-компиляция либо тесты с подменой терминала MUST NOT заменять эту проверку

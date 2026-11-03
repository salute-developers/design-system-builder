## MODIFIED Requirements

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

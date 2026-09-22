## MODIFIED Requirements

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

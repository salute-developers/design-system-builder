## MODIFIED Requirements

### Requirement: CLI theme fetch command

CLI `dsbuilder` SHALL предоставлять project-scoped команду `theme fetch` для загрузки tenants, token meta и token values в локальную `.sdds`; backend requests SHALL использовать credential, выбранный общей policy.

#### Scenario: Theme fetch использует project-scoped context

- **WHEN** разработчик запускает `dsbuilder theme fetch` внутри initialized project directory
- **THEN** CLI MUST разрешить ближайшую `.sdds/config.json`
- **THEN** CLI MUST разрешить credential и API URL через CLI core
- **THEN** CLI MUST использовать `projectId` и `designSystemId` из config для design-system scoped requests
- **THEN** CLI MUST отправить `Authorization: ProjectKey <key>` либо `Authorization: Bearer <token>` согласно policy
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Theme fetch принимает runtime overrides

- **WHEN** key mode выбран и разработчик запускает `dsbuilder theme fetch --api-key secret --api-url https://api.example.com`
- **THEN** CLI MUST использовать `secret` как runtime API key
- **THEN** CLI MUST использовать `https://api.example.com` как backend API URL
- **THEN** CLI MUST NOT записывать raw API key или API URL в `.sdds/config.json`

#### Scenario: Theme fetch с user session

- **WHEN** config выбирает `user-session` и для resolved API URL доступна session
- **THEN** все backend-запросы команды MUST использовать Bearer access token
- **THEN** команда MUST NOT требовать project key

#### Scenario: Theme fetch по ссылке без локального config

- **WHEN** разработчик запускает `dsbuilder theme fetch --design-system <uri> --destination <directory>` вне initialized project directory
- **THEN** CLI MUST загрузить данные выбранной дизайн-системы в `<directory>/.sdds`
- **THEN** CLI MUST создать там config с project/design-system identifiers и credential reference без raw secrets
- **THEN** CLI MUST NOT перезаписать существующий config в destination

#### Scenario: Theme fetch по ссылке без destination

- **WHEN** явная ссылка передана вне initialized project directory без `--destination`
- **THEN** команда MUST сообщить о необходимом локальном destination до backend-запроса

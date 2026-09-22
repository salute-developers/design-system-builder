## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: CLI project-scoped command foundation

Project-scoped CLI commands SHALL использовать общие context, API URL и credential services; выбор credential SHALL соответствовать локальной policy или headless policy, не меняя actor после backend authorization failure.

#### Scenario: Project command использует CLI core

- **WHEN** новая project-scoped команда добавлена в `dsbuilder`
- **THEN** она MUST разрешать локальный или явный контекст через CLI core
- **THEN** она MUST разрешать credential через общий provider
- **THEN** её HTTP adapter MUST отправлять `Authorization: ProjectKey <key>` либо `Authorization: Bearer <token>` согласно выбранному credential

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

- **WHEN** локальная policy `auto` не находит project key и для resolved API URL доступна user session
- **THEN** команда MUST выполнить backend request с Bearer access token

#### Scenario: Project key найден, но отклонен

- **WHEN** backend отвечает `401` или `403` для выбранного project key
- **THEN** команда MUST вернуть соответствующую ошибку
- **THEN** команда MUST NOT повторять запрос от другого actor

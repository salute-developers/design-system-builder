## MODIFIED Requirements

### Requirement: CLI theme fetch command

CLI SHALL предоставлять `theme fetch` для загрузки тем, метаданных и значений токенов в локальную `.sdds`. Авторизация SHALL использовать общий выбор PAT/OAuth независимо от источника контекста.

#### Scenario: Theme fetch использует project-scoped context

- **WHEN** пользователь запускает `dsbuilder theme fetch` в настроенном локальном проекте
- **THEN** CLI MUST разрешить ближайшую `.sdds/config.json`, API URL и учётные данные через общие сценарии
- **AND** MUST использовать `projectId` и `designSystemId` выбранного контекста
- **AND** MUST передать `Authorization: Bearer <PAT>` либо Bearer OAuth access token согласно выбранному типу
- **AND** MUST NOT выводить секреты

#### Scenario: Theme fetch принимает runtime overrides

- **WHEN** в режиме `auto` пользователь передаёт `theme fetch --api-key <secret>`
- **THEN** CLI MUST использовать этот PAT с наивысшим приоритетом
- **AND** MUST разрешить API URL по общей политике независимо от PAT
- **AND** MUST NOT записывать PAT или API URL в `.sdds/config.json`

#### Scenario: Theme fetch с user session

- **WHEN** конфигурация выбирает `user-session` и доступна подходящая OAuth-сессия
- **THEN** все запросы MUST использовать OAuth access token без требования PAT

#### Scenario: Theme fetch по ссылке без локального config

- **WHEN** пользователь передаёт `--design-system <uri> --destination <directory>` вне настроенного проекта
- **THEN** CLI MUST загрузить выбранную дизайн-систему в `<directory>/.sdds`
- **AND** MUST создать конфигурацию с идентификаторами проекта/дизайн-системы и ссылкой на источник учётных данных без секретов
- **AND** MUST NOT перезаписывать существующую конфигурацию назначения
- **AND** выбор авторизации MUST использовать `auto`: `--api-key`, `DSBUILDER_API_KEY` процесса, затем OAuth-сессию без чтения постороннего `.env`

#### Scenario: Theme fetch по ссылке без destination

- **WHEN** ссылка передана вне настроенного проекта без `--destination`
- **THEN** команда MUST сообщить о необходимом каталоге назначения до сетевых запросов

#### Scenario: Сервер отклонил PAT

- **WHEN** запрос с PAT получает `401` или `403`
- **THEN** CLI MUST вернуть `PAT_INVALID` или `FORBIDDEN` без смены пользователя, обновления OAuth-сессии и повтора с другими учётными данными

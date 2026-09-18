# frontend-client-authentication Specification

## Purpose
TBD - created by archiving change add-frontend-mcp-server. Update Purpose after archive.
## Requirements
### Requirement: Общая пользовательская авторизация CLI и MCP

`frontend-kt` SHALL предоставлять общую пользовательскую access/refresh session для `dsbuilder` и `dsbuilder-mcp`,
использующую тот же resolved API URL, что и DS Builder API.

#### Scenario: Интерактивный login получает token через gateway

- **WHEN** пользователь запускает `auth login` с выбранным `--api-url`
- **THEN** клиент MUST запросить login и password интерактивно с выключенным echo для password
- **THEN** клиент MUST отправить Direct Access Grant в `POST <apiUrl>/auth/token` с фиксированным public `clientId`
- **THEN** клиент MUST NOT принимать password через command-line argument
- **THEN** клиент MUST NOT сохранять password после завершения запроса

#### Scenario: Небезопасный auth URL отклоняется

- **WHEN** `auth login` разрешает API URL с plain HTTP
- **THEN** host MUST быть `localhost` или `127.0.0.1`
- **THEN** любой другой plain HTTP URL MUST быть отклонен до отправки login/password

#### Scenario: Auth команды доступны в обоих executable

- **WHEN** пользователь запускает `dsbuilder auth --help` или `dsbuilder-mcp auth --help`
- **THEN** оба executable MUST предоставлять `login`, `status` и `logout`
- **THEN** обе presentation-реализации MUST вызывать общие auth use cases

### Requirement: File-based user session

Пользовательская session SHALL храниться отдельно для каждого нормализованного backend API URL в
`~/.sdds/sessions/<backend-url-hash>.json` через общий `CredentialStore` port.

#### Scenario: Session сохраняет минимальный секретный state

- **WHEN** login или refresh успешно возвращает token response
- **THEN** session MUST содержать только `schemaVersion`, `apiUrl`, `username`, `refreshToken`, `refreshExpiresAt` и `updatedAt`
- **THEN** session MUST NOT содержать password, access token, ID token, роли, project context или design-system context
- **THEN** access token MUST оставаться только в памяти процесса

#### Scenario: Session из другого environment не используется

- **WHEN** resolved API URL не совпадает с точным нормализованным `apiUrl` внутри прочитанной session
- **THEN** клиент MUST отклонить session
- **THEN** клиент MUST NOT отправлять ее refresh token в выбранный backend

#### Scenario: Session file защищен и заменяется атомарно

- **WHEN** platform поддерживает POSIX permissions
- **THEN** session directory MUST иметь режим `0700`, а session file — `0600`
- **WHEN** session обновляется
- **THEN** новый JSON MUST быть полностью записан во временный файл до atomic replace исходного файла

### Requirement: Обязательная ротация refresh token

CLI и MCP SHALL сохранять включенную ротацию refresh token и координировать concurrent refresh одной session через
межпроцессную блокировку.

#### Scenario: Один процесс обновляет session

- **WHEN** процесс получает refresh lock
- **THEN** он MUST повторно прочитать актуальную session после получения lock
- **THEN** он MUST обменять актуальный refresh token через `POST <apiUrl>/auth/token`
- **THEN** он MUST атомарно сохранить rotated refresh token до снятия lock

#### Scenario: Второй процесс ожидает refresh

- **WHEN** CLI или MCP обнаруживает занятый refresh lock
- **THEN** процесс MUST дождаться освобождения lock в пределах ограниченного timeout
- **THEN** процесс MUST перечитать обновленную session вместо использования ранее прочитанного refresh token

#### Scenario: Rotated token не был сохранен из-за аварии

- **WHEN** новый refresh token выдан, но процесс завершился до atomic save
- **THEN** следующий refresh MUST завершиться `AUTH_REQUIRED`, если старый token уже невалиден
- **THEN** клиент MUST NOT отключать ротацию или повторно разрешать старый token как recovery mechanism

### Requirement: Единый credential priority

CLI и MCP SHALL выбирать backend credential согласно явной credential policy. В `auto` доступный project key имеет приоритет над user session; forced policy SHALL использовать только указанный тип; после backend authorization failure actor MUST NOT меняться.

#### Scenario: Project key найден

- **WHEN** policy `auto` находит непустой runtime project key
- **THEN** запрос MUST использовать `Authorization: ProjectKey <key>`
- **THEN** user session MUST NOT использоваться для этого запроса

#### Scenario: Project key отсутствует

- **WHEN** policy `auto` не находит project key
- **WHEN** для resolved API URL существует валидная user session
- **THEN** клиент MUST получить access token и использовать `Authorization: Bearer <token>`

#### Scenario: Принудительная session

- **WHEN** policy выбирает `user-session`
- **THEN** клиент MUST использовать session для resolved API URL или вернуть `AUTH_REQUIRED`
- **THEN** клиент MUST NOT выбирать доступный project key

#### Scenario: Принудительный key

- **WHEN** policy выбирает `project-key-env`
- **THEN** клиент MUST использовать выбранный key или вернуть credential error
- **THEN** клиент MUST NOT выбирать user session

#### Scenario: Project key отклонен backend

- **WHEN** запрос с найденным project key получает `401` или `403`
- **THEN** клиент MUST вернуть `PROJECT_KEY_INVALID` или `FORBIDDEN`
- **THEN** клиент MUST NOT повторять запрос с пользовательским credential

#### Scenario: Bearer получает HTTP 401

- **WHEN** backend отвечает `401` на GET, POST или multipart POST с пользовательским Bearer
- **THEN** общий authenticated HTTP слой MUST принудительно обновить ту же user session и повторить запрос ровно один раз
- **THEN** повторный `401` MUST удалить session и вернуть `AUTH_REQUIRED` без выбора project key

#### Scenario: Bearer получает HTTP 403

- **WHEN** backend отвечает `403` на запрос с пользовательским Bearer
- **THEN** клиент MUST вернуть `FORBIDDEN` без refresh и повтора

#### Scenario: Token endpoint недоступен во время refresh

- **WHEN** credential provider возвращает `BACKEND_UNAVAILABLE` при обновлении выбранной user session
- **THEN** project-scoped read scenario и MCP MUST сохранить `BACKEND_UNAVAILABLE`
- **THEN** клиент MUST NOT сообщать `AUTH_REQUIRED` и MUST NOT удалять session из-за transport failure

### Requirement: User access token lifecycle

Общий `CredentialProvider` SHALL обновлять пользовательский access token до истечения и применять ограниченную retry
policy без удаления session при транспортных ошибках.

#### Scenario: User access token получает 401

- **WHEN** backend возвращает `401` для user access token
- **THEN** клиент MAY выполнить ровно один forced refresh и ровно один retry исходного запроса
- **THEN** повторный `401` или `invalid_grant` MUST удалить локальную session и вернуть `AUTH_REQUIRED`

#### Scenario: User access token получает 403

- **WHEN** backend возвращает `403` для user access token
- **THEN** клиент MUST вернуть `FORBIDDEN`
- **THEN** клиент MUST NOT выполнять token refresh

#### Scenario: Backend временно недоступен

- **WHEN** token или API request завершается transport failure
- **THEN** клиент MUST вернуть `BACKEND_UNAVAILABLE`
- **THEN** сохраненная user session MUST остаться доступной для следующей попытки

### Requirement: User session для всех авторизованных CLI операций

Каждая CLI-команда, выполняющая project-scoped backend request, SHALL поддерживать выбранный Bearer user credential наряду с project key и SHALL передавать ответ backend об отказе без смены actor. Проверка project role на `db-service` `component-config/import` остаётся отдельным backend gap, описанным в `backend-audit.md`.

#### Scenario: Публикация с user session

- **WHEN** локальная policy выбирает `user-session` и пользователь имеет нужную роль в проекте
- **THEN** `docs publish` MUST отправить Bearer access token через project-scoped gateway route
- **THEN** команда MUST обработать backend результат без требования project key

#### Scenario: Пользователь не имеет права на запись

- **WHEN** backend отвечает `403` на запись с Bearer credential
- **THEN** CLI MUST вернуть `FORBIDDEN`
- **THEN** CLI MUST NOT повторять запрос с project key


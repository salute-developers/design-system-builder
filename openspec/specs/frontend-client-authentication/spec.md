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

CLI и MCP SHALL выбирать backend credential в порядке project key, user session, `AUTH_REQUIRED`.

#### Scenario: Project key найден

- **WHEN** project credential reference разрешается в непустой runtime project key
- **THEN** запрос MUST использовать `Authorization: ProjectKey <key>`
- **THEN** user session MUST NOT использоваться для этого запроса

#### Scenario: Project key отсутствует

- **WHEN** project key отсутствует во всех разрешенных runtime sources
- **WHEN** для resolved API URL существует валидная user session
- **THEN** клиент MUST получить access token и использовать `Authorization: Bearer <token>`

#### Scenario: Project key отклонен backend

- **WHEN** запрос с найденным project key получает `401` или `403`
- **THEN** клиент MUST вернуть `PROJECT_KEY_INVALID` или `FORBIDDEN`
- **THEN** клиент MUST NOT повторять запрос с пользовательским credential

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


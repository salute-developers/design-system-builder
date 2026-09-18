## ADDED Requirements

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

## MODIFIED Requirements

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

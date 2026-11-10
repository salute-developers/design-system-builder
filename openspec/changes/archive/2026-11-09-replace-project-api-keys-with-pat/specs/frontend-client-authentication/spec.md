## MODIFIED Requirements

### Requirement: User session для всех авторизованных CLI операций

Каждая CLI-команда, выполняющая project-scoped backend request, SHALL поддерживать выбранный Bearer user credential наряду с PAT и SHALL передавать ответ backend об отказе без смены actor.

#### Scenario: Публикация с user session

- **WHEN** локальная policy выбирает `user-session` и пользователь имеет нужную роль в проекте
- **THEN** `docs publish` MUST отправить Bearer access token через project-scoped gateway route
- **THEN** команда MUST обработать backend результат без требования PAT

#### Scenario: Пользователь не имеет права на запись

- **WHEN** backend отвечает `403` на запись с Bearer credential
- **THEN** CLI MUST вернуть `FORBIDDEN`
- **THEN** CLI MUST NOT повторять запрос с PAT

## ADDED Requirements

### Requirement: PAT имеет самостоятельный жизненный цикл клиента

CLI/MCP SHALL отличать PAT от OAuth-сессии независимо от общей схемы Bearer, SHALL использовать PAT только в памяти запроса и MUST NOT сохранять его в файлах сессий, конфигурации, журнале или диагностике.

#### Scenario: Запрос с PAT
- **WHEN** выбран PAT
- **THEN** HTTP-клиент MUST передать `Authorization: Bearer <PAT>`
- **AND** MUST NOT обращаться к OAuth token endpoint

#### Scenario: MCP использует окружение
- **WHEN** сервер MCP запущен с `DSBUILDER_API_KEY`
- **THEN** инструменты MUST использовать общий выбор учётных данных без открытия браузера
- **AND** схемы инструментов MUST NOT требовать передачи секрета PAT

### Requirement: Единый приоритет PAT и OAuth
CLI и MCP SHALL выбирать backend credential согласно явной credential policy. В `auto` явный `--api-key`, затем PAT из настроенного окружения, затем `DSBUILDER_API_KEY` имеют приоритет над user session; forced policy SHALL использовать только указанный тип; после backend authorization failure actor MUST NOT меняться.

#### Scenario: PAT найден

- **WHEN** policy `auto` находит непустой runtime PAT
- **THEN** запрос MUST использовать `Authorization: Bearer <PAT>`
- **THEN** user session MUST NOT использоваться для этого запроса

#### Scenario: PAT отсутствует

- **WHEN** policy `auto` не находит PAT
- **WHEN** для resolved API URL существует валидная user session
- **THEN** клиент MUST получить access token и использовать `Authorization: Bearer <token>`

#### Scenario: Принудительная session

- **WHEN** policy выбирает `user-session`
- **THEN** клиент MUST использовать session для resolved API URL или вернуть `AUTH_REQUIRED`
- **THEN** клиент MUST NOT выбирать доступный PAT

#### Scenario: Принудительный PAT

- **WHEN** policy выбирает `pat-env`
- **THEN** клиент MUST использовать выбранный PAT или вернуть credential error
- **THEN** клиент MUST NOT выбирать user session

#### Scenario: PAT отклонен backend

- **WHEN** запрос с найденным PAT получает `401` или `403`
- **THEN** клиент MUST вернуть `PAT_INVALID` или `FORBIDDEN`
- **THEN** клиент MUST NOT повторять запрос с пользовательским credential

#### Scenario: Bearer получает HTTP 401

- **WHEN** backend отвечает `401` на GET, POST или multipart POST с пользовательским Bearer
- **THEN** общий authenticated HTTP слой MUST принудительно обновить ту же user session и повторить запрос ровно один раз
- **THEN** повторный `401` MUST удалить session и вернуть `AUTH_REQUIRED` без выбора PAT

#### Scenario: Bearer получает HTTP 403

- **WHEN** backend отвечает `403` на запрос с пользовательским Bearer
- **THEN** клиент MUST вернуть `FORBIDDEN` без refresh и повтора

#### Scenario: Token endpoint недоступен во время refresh

- **WHEN** credential provider возвращает `BACKEND_UNAVAILABLE` при обновлении выбранной user session
- **THEN** project-scoped read scenario и MCP MUST сохранить `BACKEND_UNAVAILABLE`
- **THEN** клиент MUST NOT сообщать `AUTH_REQUIRED` и MUST NOT удалять session из-за transport failure


#### Scenario: PAT получает HTTP 401

- **WHEN** GET, POST или multipart POST с PAT получает `401`
- **THEN** клиент MUST вернуть `PAT_INVALID` без OAuth refresh и повтора
- **AND** MUST NOT удалять или менять сохранённую OAuth-сессию

#### Scenario: PAT получает HTTP 403

- **WHEN** запрос с PAT получает `403`
- **THEN** клиент MUST вернуть `FORBIDDEN` без повтора и смены учётных данных

## REMOVED Requirements

### Requirement: Единый credential priority

**Reason**: Прежний контракт проектных ключей заменяется самостоятельным контрактом PAT.

**Migration**: Использовать требование «Единый приоритет PAT и OAuth» этого изменения; старые проектные секреты отключаются без преобразования.

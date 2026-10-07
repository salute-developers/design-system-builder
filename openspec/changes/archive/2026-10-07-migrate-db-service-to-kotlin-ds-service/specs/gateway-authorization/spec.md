## ADDED Requirements

### Requirement: Gateway направляет предметный API в ds-service

Gateway SHALL направлять согласованный набор `/api/projects/{projectId}/ds/**` в `ds-service` после project-scoped авторизации и SHALL переписывать публичный префикс во внутренний `/api/ds` без изменения остатка пути и query string.

#### Scenario: Вызов перенесённого маршрута

- **WHEN** авторизованный клиент вызывает маршрут из route manifest `ds-service`
- **THEN** Gateway MUST передать запрос в `ds-service`
- **AND** MUST сохранить HTTP-метод, query string, тело и допустимые заголовки
- **AND** MUST установить trusted context из Auth Helper

#### Scenario: Исключённый маршрут временно остаётся в db-service

- **WHEN** конфигурация совместного существования содержит более специфичное правило для исключённого маршрута
- **THEN** Gateway MUST направить только этот маршрут в `db-service`
- **AND** общее правило `/ds/**` MUST направлять разрешённый набор в `ds-service`

#### Scenario: Атомарный откат

- **WHEN** оператор активирует проверенную конфигурацию отката
- **THEN** Gateway MUST вернуть весь перенесённый набор на upstream `db-service`
- **AND** MUST сохранить прежний публичный путь и trusted context

## MODIFIED Requirements

### Requirement: Gateway protects project routes

Gateway SHALL направлять project-scoped routes через internal auth flow перед проксированием в downstream-сервисы, включая `ds-service`.

#### Scenario: Запрос к project-scoped API

- **WHEN** клиент обращается к `/projects/{projectId}/...`
- **THEN** Gateway MUST запросить Auth Helper до проксирования запроса

#### Scenario: Запрос без доступа

- **WHEN** Auth Helper возвращает отказ доступа
- **THEN** Gateway MUST вернуть клиенту `401 Unauthorized` или `403 Forbidden` без вызова downstream-сервиса

#### Scenario: Прямой доступ к ds-service

- **WHEN** внешний клиент пытается обратиться к внутреннему порту `ds-service`, минуя Gateway
- **THEN** сетевой контур MUST запретить внешний доступ
- **AND** сам `ds-service` MUST отклонить запрос без корректного trusted context

### Requirement: Trusted request context headers

Gateway SHALL передавать downstream-сервисам нормализованный trusted context только после успешной проверки и SHALL передавать `ds-service` все поля principal, необходимые общей RBAC-политике.

#### Scenario: User actor context

- **WHEN** authenticated user получает доступ к project-scoped route
- **THEN** Gateway MUST передать `X-Actor-Type`, `X-User-Id`, `X-Project-Id`, `X-Project-Role` и `X-System-Admin`

#### Scenario: Project key actor context

- **WHEN** валидный project access key получает доступ к project-scoped route
- **THEN** Gateway MUST передать `X-Actor-Type`, `X-Project-Id`, `X-Project-Key-Id`, `X-Project-Scopes` и `X-System-Admin`

#### Scenario: Incoming trusted headers are spoofed

- **WHEN** внешний клиент отправляет `X-User-Id`, `X-Project-Role`, `X-Project-Scopes` или другие trusted headers
- **THEN** Gateway MUST удалить incoming values и установить только значения, полученные от Auth Helper

#### Scenario: Project id не совпадает

- **WHEN** `projectId` публичного пути не совпадает с проверенным `X-Project-Id`
- **THEN** Gateway MUST отклонить запрос до переписывания пути и предметной операции
- **AND** MUST NOT передавать запрос в `ds-service`

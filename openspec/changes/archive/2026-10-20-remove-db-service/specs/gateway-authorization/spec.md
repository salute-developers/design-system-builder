## MODIFIED Requirements

### Requirement: Gateway направляет предметный API в ds-service

Gateway SHALL направлять согласованный набор `/api/projects/{projectId}/ds/**` в `ds-service` после project-scoped авторизации и SHALL переписывать публичный префикс во внутренний `/api/ds` без изменения остатка пути и query string.

#### Scenario: Вызов перенесённого маршрута

- **WHEN** авторизованный клиент вызывает маршрут из route manifest `ds-service`
- **THEN** Gateway MUST передать запрос в `ds-service`
- **AND** MUST сохранить HTTP-метод, query string, тело и допустимые заголовки
- **AND** MUST установить trusted context из Auth Helper

#### Scenario: Исключённый маршрут временно остаётся в db-service

- **WHEN** клиент вызывает исключённый маршрут `/api/projects/{projectId}/ds/legacy/**`
- **THEN** Gateway MUST ответить `404`: upstream db-service удалён
- **AND** общее правило `/ds/**` MUST направлять разрешённый набор в `ds-service`

#### Scenario: Атомарный откат

- **WHEN** оператор откатывает предметный API
- **THEN** откат выполняется версией образа `ds-service`
- **AND** конфигурация Gateway MUST остаться прежней: единственный upstream предметного API — `ds-service`

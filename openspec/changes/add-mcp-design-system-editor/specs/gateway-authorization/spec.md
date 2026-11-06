## MODIFIED Requirements

### Requirement: Gateway направляет предметный API в ds-service

Gateway SHALL направлять коллекцию /api/projects/{projectId}/design-systems и данные /api/projects/{projectId}/design-systems/{designSystemId}/… в ds-service после проектной авторизации с сохранением DS path-контекста. Общий каталог сохраняет отдельные маршруты /api/projects/{projectId}/ds/…. Внутренняя адресация SHALL соответствовать общей декларативной карте областей.

#### Scenario: Вызов перенесённого маршрута

- **WHEN** авторизованный клиент вызывает маршрут из route manifest `ds-service`
- **THEN** Gateway MUST передать запрос в `ds-service`
- **AND** MUST сохранить HTTP-метод, query string, тело и допустимые заголовки
- **AND** MUST установить trusted context из Auth Helper

#### Scenario: Исключённый маршрут временно остаётся в db-service

- **WHEN** клиент вызывает исключённый маршрут `/api/projects/{projectId}/ds/legacy/**`
- **THEN** Gateway MUST ответить `404`: upstream db-service удалён
- **AND** правила областей MUST направлять разрешённый набор в ds-service без старого обходного маршрута данных DS

#### Scenario: Атомарный откат

- **WHEN** оператор откатывает предметный API
- **THEN** откат выполняется версией образа `ds-service`
- **AND** откат Gateway и клиентов MUST быть согласован с контрактом DS-путей; альтернативный неограниченный путь MUST NOT появляться

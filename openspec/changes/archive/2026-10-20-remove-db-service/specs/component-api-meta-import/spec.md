## MODIFIED Requirements

### Requirement: API meta import endpoint

`ds-service` SHALL выполнять импорт API-меты, а Gateway SHALL предоставлять его клиентам как `POST /api/admin/component-config/import-api-meta`, принимающий манифест API-меты компонентов целиком одним запросом и записывающий его в глобальный слой компонентной модели в одной транзакции. Gateway MUST переписывать этот путь в `ds-service` как `POST /api/ds/admin/component-config/import-api-meta`. Проектный маршрут `POST /api/projects/{projectId}/ds/component-config/import-api-meta` MUST NOT существовать.

#### Scenario: Манифест принимается одним запросом

- **WHEN** клиент отправляет манифест с несколькими компонентами
- **THEN** backend MUST обработать все компоненты в одном запросе и одной транзакции
- **THEN** путь запроса MUST NOT содержать идентификаторов проекта или дизайн-системы и custom method через двоеточие

#### Scenario: Запрос не адресуется дизайн-системе

- **WHEN** клиент отправляет манифест
- **THEN** backend MUST NOT требовать в теле `designSystemId`
- **THEN** backend MUST NOT искать дизайн-систему и MUST NOT отвечать `404` из-за неё

#### Scenario: Проектный маршрут удалён

- **WHEN** клиент обращается к `POST /api/projects/{projectId}/ds/component-config/import-api-meta`
- **THEN** backend MUST ответить `404`

#### Scenario: Невалидное тело

- **WHEN** тело не проходит валидацию схемы запроса
- **THEN** backend MUST ответить статусом валидации и MUST NOT изменить данные

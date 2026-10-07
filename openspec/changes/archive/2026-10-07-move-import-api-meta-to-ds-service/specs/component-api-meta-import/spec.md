## MODIFIED Requirements

### Requirement: API meta import endpoint

`ds-service` SHALL выполнять импорт API-меты, а Gateway SHALL предоставлять его клиентам как `POST /api/admin/component-config/import-api-meta`, принимающий манифест API-меты компонентов целиком одним запросом и записывающий его в глобальный слой компонентной модели в одной транзакции. Gateway MUST переписывать этот путь в `ds-service` как `POST /api/ds/admin/component-config/import-api-meta`; `db-service` MUST NOT обслуживать этот маршрут. Проектный маршрут `POST /api/projects/{projectId}/ds/component-config/import-api-meta` MUST NOT существовать.

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

### Requirement: API meta import is restricted to system administrators

Импорт API-меты SHALL быть доступен только системному администратору. `ds-service` MUST проверять доверенный контекст (`X-System-Admin: true`) и MUST отказывать во всех остальных случаях, включая отсутствие заголовка. У глобальной операции проекта нет, поэтому Gateway MUST передавать служебный `X-Project-Id: global` только на этом маршруте и только после проверки токена пользователя.

#### Scenario: Системный администратор

- **WHEN** запрос приходит с `X-System-Admin: true`
- **THEN** backend MUST выполнить импорт

#### Scenario: Не системный администратор

- **WHEN** запрос приходит с `X-System-Admin`, отличным от `true`, например с `false` (пользователь без роли или ключ проекта)
- **THEN** backend MUST ответить `403` и MUST NOT изменить данные

#### Scenario: Заголовка нет

- **WHEN** запрос приходит без заголовка `X-System-Admin` (прямой вызов в обход gateway)
- **THEN** backend MUST ответить `403` и MUST NOT изменить данные

#### Scenario: Проверка до разбора тела

- **WHEN** запрос отклоняется как не административный
- **THEN** backend MUST ответить `403` до разбора тела, даже если тело невалидно

#### Scenario: Ключ проекта не принимается gateway

- **WHEN** запрос на административный маршрут приходит с `Authorization: ProjectKey <token>`
- **THEN** gateway MUST ответить `401` и MUST NOT передавать запрос в backend

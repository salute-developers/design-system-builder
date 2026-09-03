## ADDED Requirements

### Requirement: Authenticated user can create project

Система SHALL позволять любому authenticated `user` создать проект.

#### Scenario: Создание проекта

- **WHEN** authenticated пользователь отправляет `POST /projects` с валидным request DTO
- **THEN** система MUST создать active project и назначить пользователя единственным Owner

#### Scenario: Gateway пропускает create project только для authenticated user

- **WHEN** Gateway получает `POST /projects` без валидного bearer token
- **THEN** Gateway/Auth Helper MUST отклонить запрос как `401 Unauthorized`

### Requirement: Project owner is unique

Система SHALL гарантировать, что у проекта есть ровно один Owner.

#### Scenario: Созданный проект имеет одного Owner

- **WHEN** проект создан
- **THEN** `ownerUserId` MUST быть заполнен user id создателя

#### Scenario: Owner не хранится как member role

- **WHEN** система создает проект
- **THEN** она MUST NOT создавать `project_members` запись с role `owner`

### Requirement: Project metadata can be read and updated

Система SHALL предоставлять API для чтения и обновления metadata проекта.

#### Scenario: Пользователь получает список своих проектов

- **WHEN** authenticated пользователь запрашивает `GET /projects`
- **THEN** система MUST вернуть список проектов, где пользователь является Owner или member

#### Scenario: Gateway пропускает list projects только для authenticated user

- **WHEN** Gateway получает `GET /projects` без валидного bearer token
- **THEN** Gateway/Auth Helper MUST отклонить запрос как `401 Unauthorized`

#### Scenario: Gateway использует Projects Service для project authorization

- **WHEN** Gateway получает project-scoped запрос `GET /projects/{projectId}` или другой `/projects/{projectId}/...`
- **THEN** Auth Helper MUST определить effective project role через internal HTTP API Projects Service, а не через fallback allow-authenticated mode

#### Scenario: System admin получает все проекты

- **WHEN** пользователь с global role `system_admin` запрашивает `GET /projects`
- **THEN** система MUST вернуть список всех проектов независимо от membership

#### Scenario: Archived project остается видимым в списке

- **WHEN** пользователь запрашивает `GET /projects` и имеет доступ к archived project
- **THEN** система MUST вернуть archived project в списке с `status = archived`

#### Scenario: Участник читает проект

- **WHEN** Owner, Maintainer, Editor или Viewer запрашивает `GET /projects/{projectId}`
- **THEN** система MUST вернуть project response DTO

#### Scenario: Maintainer обновляет metadata

- **WHEN** Maintainer отправляет `PATCH /projects/{projectId}` с валидным request DTO
- **THEN** система MUST обновить metadata проекта

### Requirement: Project archive and restore

Система SHALL поддерживать обратимое архивирование проекта.

#### Scenario: Owner архивирует проект

- **WHEN** Owner отправляет `POST /projects/{projectId}/archive`
- **THEN** система MUST перевести проект в status `archived`

#### Scenario: Owner восстанавливает проект

- **WHEN** Owner отправляет `POST /projects/{projectId}/restore` для archived project
- **THEN** система MUST перевести проект в status `active`

#### Scenario: Archived project blocks modification

- **WHEN** пользователь пытается изменить metadata, members или access keys archived project
- **THEN** система MUST отклонить операцию, кроме явно разрешенного restore

### Requirement: Internal project access-check is protected

Система SHALL защищать internal access-check endpoint от неавторизованного прямого вызова.

#### Scenario: Internal access-check без internal API key

- **WHEN** клиент вызывает `GET /internal/projects/{projectId}/access-check` без валидного shared internal API key
- **THEN** система MUST вернуть `403 Forbidden`

#### Scenario: Auth Helper вызывает internal access-check с internal API key

- **WHEN** Auth Helper вызывает `GET /internal/projects/{projectId}/access-check` с валидным shared internal API key
- **THEN** Projects Service MUST обработать role check и вернуть effective project role или deny response

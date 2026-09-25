## MODIFIED Requirements

### Requirement: Project metadata can be read and updated

Система SHALL предоставлять API для чтения и обновления metadata проекта и SHALL возвращать итоговую роль текущего пользователя в доступном проекте.

#### Scenario: Пользователь получает список своих проектов

- **WHEN** authenticated пользователь запрашивает `GET /projects`
- **THEN** система MUST вернуть список проектов, где пользователь является Owner или member
- **THEN** каждый project response DTO MUST содержать `effectiveRole` со значением `owner`, `maintainer`, `editor` или `viewer` для текущего пользователя

#### Scenario: Пользователь получает карточку проекта

- **WHEN** authenticated пользователь запрашивает доступный `GET /projects/{projectId}`
- **THEN** project response DTO MUST содержать `effectiveRole` текущего пользователя в этом проекте

#### Scenario: Gateway пропускает list projects только для authenticated user

- **WHEN** Gateway получает `GET /projects` без валидного bearer token
- **THEN** Gateway/Auth Helper MUST отклонить запрос как `401 Unauthorized`

#### Scenario: Gateway использует Projects Service для project authorization

- **WHEN** Gateway получает project-scoped запрос `GET /projects/{projectId}` или другой `/projects/{projectId}/...`
- **THEN** Auth Helper MUST определить effective project role через internal HTTP API Projects Service, а не через fallback allow-authenticated mode

#### Scenario: System admin получает все проекты

- **WHEN** пользователь с global role `system_admin` запрашивает `GET /projects`
- **THEN** система MUST вернуть список всех проектов независимо от membership
- **THEN** каждый project response DTO MUST содержать `effectiveRole = owner`

#### Scenario: Archived project остается видимым в списке

- **WHEN** пользователь запрашивает `GET /projects` и имеет доступ к archived project
- **THEN** система MUST вернуть archived project в списке с `status = archived`

#### Scenario: Участник читает проект

- **WHEN** Owner, Maintainer, Editor или Viewer запрашивает `GET /projects/{projectId}`
- **THEN** система MUST вернуть project response DTO

#### Scenario: Maintainer обновляет metadata

- **WHEN** Maintainer отправляет `PATCH /projects/{projectId}` с валидным request DTO
- **THEN** система MUST обновить metadata проекта

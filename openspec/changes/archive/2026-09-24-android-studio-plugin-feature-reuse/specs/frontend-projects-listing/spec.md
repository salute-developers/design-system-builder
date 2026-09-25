## ADDED Requirements

### Requirement: Список проектов пользователя как переиспользуемая возможность

`frontend-kt` SHALL предоставлять модуль `feature-projects`, реализующий получение списка проектов, в которых авторизованный пользователь состоит участником, без требования уже разрешённого `ProjectContext`.

#### Scenario: Use case возвращает проекты пользователя

- **WHEN** клиентское приложение вызывает `ListProjectsUseCase` из `feature-projects` с активной пользовательской сессией
- **THEN** use case запрашивает `GET /api/projects` через authenticated HTTP client из `core-network`
- **THEN** use case возвращает список проектов, где пользователь состоит участником

#### Scenario: Пустой список — легитимный результат

- **WHEN** у авторизованного пользователя нет ни одного проекта с ролью `viewer` и выше
- **THEN** `ListProjectsUseCase` возвращает пустой список
- **THEN** это не трактуется как ошибка

#### Scenario: feature-projects не требует разрешённого ProjectContext

- **WHEN** клиентское приложение вызывает `ListProjectsUseCase` до выбора конкретного проекта или дизайн-системы
- **THEN** use case не зависит от `ContextResolver` и не требует `.sdds/config.json` или явной `dsbuilder://` ссылки

#### Scenario: feature-projects зависит только от используемых core-модулей

- **WHEN** разработчик инспектирует Gradle-зависимости `feature-projects`
- **THEN** модуль зависит от `core-network` и `core-auth`
- **THEN** модуль не зависит от `core-workspace`, `core-application` или любого другого `feature-*` модуля

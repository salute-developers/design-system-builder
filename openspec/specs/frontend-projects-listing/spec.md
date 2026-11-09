# frontend-projects-listing Specification
## Purpose
Определяет переиспользуемую возможность получения списка проектов, доступных авторизованному пользователю (`GET /api/projects`), в модуле `feature-projects` — до выбора проекта и без разрешённого `ProjectContext`.

## Requirements

### Requirement: Список проектов пользователя как переиспользуемая возможность

`frontend-kt` SHALL предоставлять модуль `feature-projects`, реализующий получение списка проектов, к которым выбранный пользователь имеет доступ, включая доступ глобального администратора, без требования уже разрешённого `ProjectContext`.

#### Scenario: Use case возвращает проекты пользователя

- **WHEN** клиентское приложение вызывает `ListProjectsUseCase` из `feature-projects` с выбранным PAT либо активной пользовательской сессией
- **THEN** use case запрашивает `GET /api/projects` через authenticated HTTP client из `core-network`
- **THEN** use case возвращает список проектов, доступных пользователю, с учётом глобального администратора

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

#### Scenario: Выбор авторизации задаёт клиент
- **WHEN** сценарий вызывается CLI или MCP
- **THEN** клиент MUST предоставить общий выбор PAT/OAuth без требования ProjectContext и без зависимости бизнес-сценария от launcher
- **WHEN** сценарий вызывается IDE с явно выбранной OAuth-сессией
- **THEN** сценарий MUST использовать эту сессию, не читая PAT из окружения IDE

#### Scenario: PAT отклонён
- **WHEN** сервер отвечает 401 выбранному PAT
- **THEN** сценарий MUST вернуть PAT_INVALID без повтора с OAuth-сессией и без изменения сохранённой сессии

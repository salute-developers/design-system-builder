## Why

DS Builder нужен project/workspace слой, который станет источником истины для владения проектами, membership и project-scoped ролей. Эта change создает Projects Service core без привязки к доменным сущностям токенов, тем и компонентов.

## What Changes

- Добавить production Projects Service с Ktor API, domain/application/data слоями и PostgreSQL persistence.
- Реализовать project как workspace: создание, list, чтение, обновление metadata, archive и restore.
- Зафиксировать инвариант единственного Owner через `ownerUserId` в проекте.
- Реализовать project members с ролями `viewer`, `editor`, `maintainer`.
- Реализовать permission checks для Owner, Maintainer, Editor, Viewer и `system_admin`.
- Добавить internal API для Gateway/Auth Helper, который возвращает роль пользователя в проекте.
- Добавить user-scoped auth integration для Gateway/Auth Helper на collection endpoints `/projects`.
- Переключить local/runtime integration Gateway/Auth Helper на project authorization через Projects Service HTTP API.
- Защитить internal project access-check endpoint через shared internal API key.

## Capabilities

### New Capabilities

- `project-management`: создание, list, чтение, обновление, архивирование и восстановление проектов.
- `project-membership-rbac`: project membership, роли и проверка доступа в контексте проекта.

### Modified Capabilities

- Нет.

## Impact

- Сервисы: новый Projects Service.
- API: public project endpoints, member endpoints, internal access-check endpoint.
- API gateway/auth helper: user-scoped auth для `/projects`, project-scoped auth для `/projects/{projectId}`.
- Persistence: таблицы projects и project_members.
- Конфигурация: database connection, service port, internal API protection.
- Инфраструктура: Dockerfile, docker-compose/local configuration, healthcheck.
- Зависимости: Ktor, Koin, Exposed/PostgreSQL, kotlinx.serialization, test libraries.

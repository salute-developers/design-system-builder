## Why

Через Gateway доступны CRUD-запросы к `tokens` и `token_values`, но `db-service` пока не проверяет для записи проект, роль и принадлежность связанных сущностей. Поэтому подключение редактора токенов Portal может изменить чужую дизайн-систему или записать значение токена в чужую тему.

## What Changes

- Защитить существующие операции создания, изменения и удаления токенов и их значений проверками доверенного project context, роли и scopes проектного ключа.
- Проверять при создании и изменении значений, что token и tenant относятся к одной дизайн-системе выбранного проекта; проверять ссылку на palette по действующей модели палитры.
- Определить явное поведение для отсутствующих и чужих ресурсов, записей без `designSystemId` и без обязательного контекста значения.
- Сохранить текущие пути Gateway и CRUD; не вводить в этом change Draft, наследование подтем, связи между токенами, редактор Portal и новые модели палитры.

## Capabilities

### New Capabilities

- `secure-token-mutations`: авторизация и целостность project-scoped записи token definitions и token values через существующий Gateway.

### Modified Capabilities

Нет.

## Impact

- `js/services/db-service`: маршруты `/ds/tokens`, `/ds/token-values`, проверки доступа, валидация запросов, OpenAPI и интеграционные тесты; существующие таблицы PostgreSQL, без запланированной миграции.
- `backend-kt/identity-gateway`: используется существующий маршрут `/api/projects/{projectId}/ds/...` и доверенные `X-Project-*` заголовки; новая конфигурация Gateway не требуется.
- `backend-kt/projects-service`: существующие роли и scopes `tokens:write`/`tokens:delete`; новые зависимости и настройки не требуются.
- `frontend-kt` и `js/apps/client`: вне scope. Portal сможет подключить запись отдельным change после защиты backend.

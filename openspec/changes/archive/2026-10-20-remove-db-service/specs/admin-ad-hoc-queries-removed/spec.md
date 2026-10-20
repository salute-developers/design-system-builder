## MODIFIED Requirements

### Requirement: Произвольные и административные запросы недоступны

ds-service SHALL NOT предоставлять маршруты `/ds/saved-queries*`, `/admin/nl-query`, `/admin/queries*`, `/admin/tables*` и `/admin/schema`, а схема MUST NOT содержать таблицу `saved_queries`. Gateway MUST NOT маршрутизировать `/api/projects/{projectId}/ds/saved-queries/**` никуда, кроме `/api/admin/component-config/import-api-meta` в ds-service. Каталога именованных запросов в репозитории нет.

#### Scenario: Запрос удалённых маршрутов

- **WHEN** клиент вызывает `GET /api/ds/saved-queries`, `POST /api/admin/nl-query` или `GET /api/admin/queries`
- **THEN** Gateway и ds-service MUST ответить 404

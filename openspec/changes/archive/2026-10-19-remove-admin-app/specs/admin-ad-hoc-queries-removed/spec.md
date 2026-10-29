## REMOVED Requirements

### Requirement: Saved queries и NL query недоступны

**Reason**: требование описывало страницу Queries админки и каталог `/api/admin/queries`; админка и все маршруты `/api/admin/*` db-service удалены.
**Migration**: нет; требование заменяется требованием «Произвольные и административные запросы недоступны».

## ADDED Requirements

### Requirement: Произвольные и административные запросы недоступны

db-service SHALL NOT предоставлять маршруты `/ds/saved-queries*`, `/admin/nl-query`, `/admin/queries*`, `/admin/tables*` и `/admin/schema`, а схема MUST NOT содержать таблицу `saved_queries`. Gateway MUST NOT маршрутизировать `/api/projects/{projectId}/ds/saved-queries/**` и `/api/admin/**` в `db-service`. Каталога именованных запросов в репозитории нет.

#### Scenario: Запрос удалённых маршрутов

- **WHEN** клиент вызывает `GET /api/ds/saved-queries`, `POST /api/admin/nl-query` или `GET /api/admin/queries`
- **THEN** db-service MUST ответить 404

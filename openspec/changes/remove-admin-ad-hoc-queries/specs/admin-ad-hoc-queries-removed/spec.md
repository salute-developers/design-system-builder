## ADDED Requirements

### Requirement: Saved queries и NL query недоступны

db-service SHALL NOT предоставлять маршруты `/ds/saved-queries*` и `/admin/nl-query`, а схема MUST NOT содержать таблицу `saved_queries`. Страница Queries админки MUST показывать только каталог именованных запросов из `/api/admin/queries`.

#### Scenario: Запрос удалённых маршрутов

- **WHEN** клиент вызывает `GET /api/ds/saved-queries` или `POST /api/admin/nl-query`
- **THEN** db-service MUST ответить 404

#### Scenario: Страница Queries

- **WHEN** пользователь открывает Queries в админке
- **THEN** в боковой панели MUST быть только записи каталога из `/api/admin/queries`, без ввода текста запроса и без кнопки сохранения

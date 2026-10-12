## MODIFIED Requirements

### Requirement: Исключённые маршруты не входят в Kotlin-сервис

`ds-service` MUST NOT реализовывать маршруты `documentation-pages`, `saved-queries`, `/legacy/**` и `/api/admin/**`, а также операции генерации артефактов. Единственное административное исключение — импорт API-меты в глобальный слой компонентов, он выполняется в `ds-service` под внутренним путём `/api/ds/admin/component-config/import-api-meta`.

| Исключённая область | Маршруты, от которых отказывается `ds-service` |
|---|---|
| Документация | `GET /documentation-pages`, `GET /documentation-pages/{id}`, `GET /documentation-pages/by-design-system/{designSystemId}`, `POST /documentation-pages`, `PATCH /documentation-pages/{id}`, `DELETE /documentation-pages/{id}` |
| Сохранённые запросы | `GET /saved-queries`, `GET /saved-queries/{id}`, `POST /saved-queries`, `PATCH /saved-queries/{id}`, `DELETE /saved-queries/{id}`, `GET /saved-queries/{id}/run` |
| Legacy | `GET /legacy/design-systems/{name}/component-configs`, `GET /legacy/design-systems/{name}/theme-data`, `GET /legacy/design-systems/{name}/tenant-params`, `POST /legacy/design-systems/create`, `POST /legacy/design-systems/{name}/update`, `GET /legacy/design-systems/{name}/download-theme` |
| Администрирование | `GET /api/admin/tables`, `GET /api/admin/tables/{name}`, `GET /api/admin/queries`, `GET /api/admin/queries/{id}`, `POST /api/admin/nl-query`, `GET /api/admin/schema` |

Отдельных смонтированных маршрутов генерации в текущем предметном router нет; `download-theme` считается legacy-операцией и исключён явно.

#### Scenario: Запрос исключённого маршрута напрямую в ds-service

- **WHEN** запрос приходит в `ds-service` по исключённому пути
- **THEN** сервис MUST вернуть `404 Not Found`
- **AND** OpenAPI `ds-service` MUST NOT описывать этот путь

#### Scenario: Совместное существование с db-service

- **WHEN** исключённый маршрут временно требуется существующему потребителю
- **THEN** Gateway MAY сохранить более специфичную маршрутизацию этого пути в `db-service`
- **AND** это MUST NOT добавлять исключённый маршрут в контракт `ds-service`

### Requirement: Gateway compatibility routing для исключённых API

Gateway MUST направлять `/api/projects/{projectId}/ds/legacy/**` и `/api/projects/{projectId}/ds/saved-queries/**` в `db-service` с существующим project-scoped trusted context. Gateway MUST направлять `/api/admin/**` в `db-service` с существующей user-authentication семантикой, кроме точного маршрута `POST /api/admin/component-config/import-api-meta`: его Gateway MUST направлять в `ds-service` (user-authentication, служебный проект `global`). `documentation-pages` MUST NOT получать fallback внутри `/ds/**`, поскольку принадлежит `documentation-service`.

#### Scenario: Сохранённый запрос остаётся доступен во время миграции

- **WHEN** авторизованный principal вызывает `/api/projects/{projectId}/ds/saved-queries`
- **THEN** Gateway проксирует запрос в `db-service`
- **AND** `ds-service` не обрабатывает этот маршрут

## ADDED Requirements

### Requirement: Административный импорт API-меты в ds-service

`ds-service` SHALL предоставлять административный маршрут `POST /api/ds/admin/component-config/import-api-meta`, который Gateway публикует как `POST /api/admin/component-config/import-api-meta`. Маршрут MUST быть доступен только доверенному системному администратору, принимать манифест API-меты одним запросом (до 16 MiB), выполнять запись аддитивно в одной транзакции и писать в журнал `design_system_changes` строку с `design_system_id = NULL`. Маршрут не входит в проектный префикс `/api/projects/{projectId}/ds`, не описывается в OpenAPI проектных маршрутов и не требует идентификатора дизайн-системы.

#### Scenario: Системный администратор импортирует мету

- **WHEN** системный администратор отправляет манифест на `POST /api/admin/component-config/import-api-meta`
- **THEN** Gateway MUST передать запрос в `ds-service` на `/api/ds/admin/component-config/import-api-meta`
- **AND** `ds-service` MUST вернуть отчёт импорта с теми же полями, что и прежняя реализация в `db-service`

#### Scenario: Пользователь без роли и прямой вызов

- **WHEN** запрос приходит без `X-System-Admin: true`
- **THEN** `ds-service` MUST ответить `403` до разбора тела и MUST NOT изменить данные

#### Scenario: Роль и права ключа проекта

- **WHEN** запрос на административный маршрут приходит с ключом проекта
- **THEN** Gateway MUST ответить `401` и MUST NOT передавать запрос в `ds-service`

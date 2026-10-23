## MODIFIED Requirements

### Requirement: Исключённые маршруты не входят в Kotlin-сервис

`ds-service` MUST NOT реализовывать маршруты `documentation-pages`, `saved-queries`, `/legacy/**`, а также операции генерации артефактов. Единственный административный маршрут продукта — импорт API-меты в глобальный слой компонентов, он выполняется в `ds-service` под внутренним путём `/api/ds/admin/component-config/import-api-meta`; других маршрутов `/api/admin/**` ни в `ds-service`, ни в `db-service` нет.

| Исключённая область | Маршруты, от которых отказывается `ds-service` |
|---|---|
| Документация | `GET /documentation-pages`, `GET /documentation-pages/{id}`, `GET /documentation-pages/by-design-system/{designSystemId}`, `POST /documentation-pages`, `PATCH /documentation-pages/{id}`, `DELETE /documentation-pages/{id}` |
| Сохранённые запросы | `GET /saved-queries`, `GET /saved-queries/{id}`, `POST /saved-queries`, `PATCH /saved-queries/{id}`, `DELETE /saved-queries/{id}`, `GET /saved-queries/{id}/run` |
| Legacy | `GET /legacy/design-systems/{name}/component-configs`, `GET /legacy/design-systems/{name}/theme-data`, `GET /legacy/design-systems/{name}/tenant-params`, `POST /legacy/design-systems/create`, `POST /legacy/design-systems/{name}/update`, `GET /legacy/design-systems/{name}/download-theme` |

Отдельных смонтированных маршрутов генерации в текущем предметном router нет; `download-theme` считается legacy-операцией и исключён явно.

#### Scenario: Запрос исключённого маршрута напрямую в ds-service

- **WHEN** запрос приходит в `ds-service` по исключённому пути
- **THEN** сервис MUST вернуть `404 Not Found`
- **AND** OpenAPI `ds-service` MUST NOT описывать этот путь

#### Scenario: Совместное существование с db-service

- **WHEN** исключённый маршрут временно требуется существующему потребителю
- **THEN** Gateway MAY сохранить более специфичную маршрутизацию этого пути в `db-service`
- **AND** это MUST NOT добавлять исключённый маршрут в контракт `ds-service`

#### Scenario: Административные маршруты db-service удалены

- **WHEN** клиент вызывает `GET /api/admin/tables`, `GET /api/admin/queries` или `GET /api/admin/schema` через Gateway или напрямую в `db-service`
- **THEN** `db-service` MUST NOT обслуживать эти пути, а OpenAPI `db-service` MUST NOT описывать тег `Admin`
- **AND** Gateway MUST NOT содержать маршрут `/api/admin/**` к `db-service`

## REMOVED Requirements

### Requirement: Gateway compatibility routing для исключённых API

**Reason**: требование направляло `/api/admin/**` и `/api/projects/{projectId}/ds/saved-queries/**` в `db-service`; этих маршрутов в db-service больше нет.
**Migration**: нет; маршрутизация `/legacy/**` и `import-api-meta` описана требованием «Gateway compatibility routing для legacy API».

## ADDED Requirements

### Requirement: Gateway compatibility routing для legacy API

Gateway MUST направлять `/api/projects/{projectId}/ds/legacy/**` в `db-service` с существующим project-scoped trusted context. Из путей `/api/admin/**` Gateway MUST публиковать только точный маршрут `POST /api/admin/component-config/import-api-meta` и направлять его в `ds-service` (user-authentication, служебный проект `global`). `documentation-pages` MUST NOT получать fallback внутри `/ds/**`, поскольку принадлежит `documentation-service`.

#### Scenario: Legacy-маршрут остаётся доступен во время миграции

- **WHEN** авторизованный principal вызывает `/api/projects/{projectId}/ds/legacy/design-systems/{name}/theme-data`
- **THEN** Gateway проксирует запрос в `db-service`
- **AND** `ds-service` не обрабатывает этот маршрут

#### Scenario: Импорт API-меты остаётся единственным административным маршрутом

- **WHEN** системный администратор вызывает `POST /api/admin/component-config/import-api-meta` с токеном пользователя
- **THEN** Gateway MUST переписать путь в `/api/ds/admin/component-config/import-api-meta` и направить его в `ds-service`
- **AND** любой другой путь под `/api/admin/` MUST NOT проксироваться в `db-service`

## MODIFIED Requirements

### Requirement: Публикация web импортирует web API-мету

Импорт меты внутри публикации MUST использовать coreRelease и неизменяемую релизную проекцию, сохраняя существующие проверки архива/manifest/хеша и административные права. Общий реестр сборок MUST переиспользоваться.

Публикация web-плагина с `dryRun=false` SHALL в той же операции, что и запись билда, импортировать переданную мету в глобальный слой компонентов платформы `web` — так же, как `POST /api/admin/component-config/import-api-meta` с `platform: web`. Ошибка импорта MUST отменять публикацию целиком: файлы не активируются, билд не записывается.

#### Scenario: Новое свойство в мете

- **WHEN** опубликован web-плагин, мета которого содержит свойство, которого нет в глобальном слое
- **THEN** свойство и его web-параметр MUST появиться в глобальном слое платформы `web`

#### Scenario: Пробная публикация

- **WHEN** публикация выполняется без `dryRun=false`
- **THEN** ни файлы, ни билд, ни мета MUST NOT записываться

#### Scenario: Согласование релиза

- **WHEN** web-архив имеет мету того же Core
- **THEN** публикация MUST связать сборку с этим релизом без второго независимого импорта в latest

### Requirement: Адрес активного web-билда выдаётся по проектному маршруту

Системный клиент MUST получать preview по контексту ДС и выбранной версии через системный маршрут. Прежний catalog-вход остаётся справочным/административным и MUST NOT определять preview опубликованной ДС.

ds-service SHALL отдавать активный web-билд маршрутом `GET /api/design-systems/catalog/web-preview/plugin` (через gateway — `GET /api/projects/{projectId}/design-systems/catalog/web-preview/plugin`) с правом чтения компонентов. Ответ SHALL содержать `buildId`, `platform: web`, `libraryVersion`, `metaSha256`, `protocolVersion`, `pluginUrl` (`<публичный адрес web>/builds/<buildId>/`) и `publishedAt`. Без активного web-билда или без настроенного хранилища web маршрут MUST отвечать `404`. Маршрут Compose MUST отдавать только Compose-билд в прежнем формате.

#### Scenario: Активный web-билд есть

- **WHEN** клиент запрашивает адрес web-плагина, а активный web-билд `0a1b2c3d4e5f` опубликован
- **THEN** ответ MUST содержать `pluginUrl`, оканчивающийся на `/builds/0a1b2c3d4e5f/`, и `platform: web`

#### Scenario: Web-билда нет

- **WHEN** ни один web-билд не опубликован
- **THEN** маршрут MUST ответить `404`, а маршрут Compose MUST продолжать отдавать Compose-билд

#### Scenario: Системный адрес

- **WHEN** запрошена V1 с закреплённой сборкой
- **THEN** ответ MUST вернуть её buildId/pluginUrl/coreRelease, независимо от глобального active

## ADDED Requirements

### Requirement: Публикация web-плагина принимает архив и мету одним запросом

ds-service SHALL принимать публикацию web-плагина маршрутом `POST /api/ds/admin/web-preview/plugin-builds?dryRun=<bool>` (через gateway — `POST /api/admin/web-preview/plugin-builds`) multipart-запросом с частями `plugin` (zip-архив) и `meta` (нормализованная API-мета `ImportApiMetaRequest`). Поле `platform` меты MUST быть `web`, иначе запрос MUST отклоняться ответом `400` с кодом `invalid_body`. Без `dryRun=false` публикация SHALL выполняться как пробная и ничего не записывать. Маршрут SHALL быть доступен роли публикации плагинов и системному администратору, как маршрут Compose; остальным MUST возвращаться `403` до чтения тела.

#### Scenario: Публикация web-плагина

- **WHEN** служебная учётка публикации отправляет архив web-плагина и мету с `platform: web` с `dryRun=false`
- **THEN** ответ MUST содержать `buildId` и статус `published`
- **THEN** билд MUST стать активным для платформы `web`, а активный билд `compose` MUST NOT измениться

#### Scenario: Мета чужой платформы

- **WHEN** в маршрут web приходит мета с `platform: compose`
- **THEN** ds-service MUST ответить `400` с кодом `invalid_body` и ничего не записать

#### Scenario: Нет роли публикации

- **WHEN** запрос отправляет пользователь без роли публикации и без прав системного администратора
- **THEN** ds-service MUST ответить `403`

### Requirement: Manifest web-плагина проверяется по правилам платформы

Архив web-плагина SHALL проходить те же проверки архива, что Compose: лимиты размера и числа файлов, запрет небезопасных путей, обязательные `index.html`, `preview-plugin.json` и `api-meta.json`, `schemaVersion: 1`, целый `protocolVersion ≥ 1`, `commit` (sha коммита), `version`, равная первым 12 символам `commit`, `apiMetaSha256`, равная sha256 файла `api-meta.json`, `entrypoint` из архива. Для платформы `web` manifest MUST содержать `platform: web` и `plasmaNewHopeVersion` в формате семантической версии; `uikitComposeVersion` не требуется. Для `compose` правила MUST NOT меняться.

#### Scenario: Корректный manifest web

- **WHEN** архив содержит `preview-plugin.json` с `platform: web`, `plasmaNewHopeVersion: 0.386.0`, `commit`, `version` и верной `apiMetaSha256`
- **THEN** проверка MUST пройти

#### Scenario: Нет версии библиотеки

- **WHEN** в manifest web-плагина нет `plasmaNewHopeVersion`
- **THEN** ds-service MUST ответить `400` с кодом `PLUGIN_MANIFEST_INVALID`

#### Scenario: Архив Compose в маршруте web

- **WHEN** в маршрут web отправлен архив с `platform: compose` в manifest
- **THEN** ds-service MUST ответить `400` с кодом `PLUGIN_MANIFEST_INVALID`

### Requirement: Билд web хранится отдельно от Compose

Файлы web-билдов SHALL записываться в хранилище web: `<префикс web>/builds/<buildId>/<путь>` в бакете из настроек web. Очистка старых web-билдов SHALL оставлять активный и заданное число последних неактивных web-билдов и MUST NOT удалять файлы или записи Compose. Запись билда SHALL хранить платформу, версию библиотеки (`plasmaNewHopeVersion` для web, `uikitComposeVersion` для Compose), sha меты, коммит, версию протокола, sha архива, размер, число файлов, автора и время публикации. Повторная публикация того же архива SHALL быть идемпотентной; тот же `buildId` с другим содержимым MUST отклоняться ответом `409` с кодом `BUILD_CONTENT_CHANGED`, а `buildId` билда другой платформы — `409` с кодом `BUILD_PLATFORM_CONFLICT`.

#### Scenario: Очистка web не трогает Compose

- **WHEN** после публикации нового web-билда число неактивных web-билдов превышает лимит
- **THEN** старые web-билды MUST быть удалены из хранилища web и базы
- **THEN** билды Compose и их файлы MUST остаться

#### Scenario: Идентификатор занят Compose

- **WHEN** публикуется web-архив с `buildId`, который уже записан для платформы `compose`
- **THEN** ds-service MUST ответить `409`

### Requirement: Публикация web импортирует web API-мету

Публикация web-плагина с `dryRun=false` SHALL в той же операции, что и запись билда, импортировать переданную мету в глобальный слой компонентов платформы `web` — так же, как `POST /api/ds/admin/component-config/import-api-meta` с `platform: web`. Ошибка импорта MUST отменять публикацию целиком: файлы не активируются, билд не записывается.

#### Scenario: Новое свойство в мете

- **WHEN** опубликован web-плагин, мета которого содержит свойство, которого нет в глобальном слое
- **THEN** свойство и его web-параметр MUST появиться в глобальном слое платформы `web`

#### Scenario: Пробная публикация

- **WHEN** публикация выполняется без `dryRun=false`
- **THEN** ни файлы, ни билд, ни мета MUST NOT записываться

### Requirement: Адрес активного web-билда выдаётся по проектному маршруту

ds-service SHALL отдавать активный web-билд маршрутом `GET /api/ds/web-preview/plugin` (через gateway — `GET /api/projects/{projectId}/ds/web-preview/plugin`) с правом чтения компонентов. Ответ SHALL содержать `buildId`, `platform: web`, `libraryVersion`, `metaSha256`, `protocolVersion`, `pluginUrl` (`<публичный адрес web>/builds/<buildId>/`) и `publishedAt`. Без активного web-билда или без настроенного хранилища web маршрут MUST отвечать `404`. Маршрут Compose MUST отдавать только Compose-билд в прежнем формате.

#### Scenario: Активный web-билд есть

- **WHEN** клиент запрашивает адрес web-плагина, а активный web-билд `0a1b2c3d4e5f` опубликован
- **THEN** ответ MUST содержать `pluginUrl`, оканчивающийся на `/builds/0a1b2c3d4e5f/`, и `platform: web`

#### Scenario: Web-билда нет

- **WHEN** ни один web-билд не опубликован
- **THEN** маршрут MUST ответить `404`, а маршрут Compose MUST продолжать отдавать Compose-билд

### Requirement: Хранилище web настраивается окружением

ds-service SHALL читать настройки хранилища web из `DS_WEB_PLUGIN_S3_BUCKET`, `DS_WEB_PLUGIN_S3_PREFIX` и `DS_WEB_PLUGIN_PUBLIC_BASE_URL`; адрес S3, регион, ключи, `path-style` и лимиты архива SHALL быть общими с Compose (`DS_PLUGIN_*`). Хранилище web SHALL считаться настроенным, только если заданы бакет web, ключи и публичный адрес web. Без настроенного хранилища web публикация web MUST отвечать `503`, а выдача адреса — `404`; Compose при этом MUST работать.

#### Scenario: Хранилище web не настроено

- **WHEN** ds-service запущен без `DS_WEB_PLUGIN_PUBLIC_BASE_URL`
- **THEN** публикация web MUST ответить `503`, а публикация Compose MUST работать как раньше

### Requirement: CLI публикует web-плагин

Команда `dsbuilder preview-plugin publish --platform react --from <zip> --api-url <url> [--apply]` SHALL публиковать web-плагин: проверять `preview-plugin.json` и `api-meta.json` архива локально (`platform: web`, `version`, `plasmaNewHopeVersion`, совпадение `apiMetaSha256`), нормализовать мету web-нормализатором (тем же, что `components import-api --platform react`) и отправлять архив и мету с `platform: web` в маршрут web. Без `--apply` CLI SHALL выполнять пробную публикацию. `--platform compose` MUST работать как раньше; другие платформы MUST отклоняться до запроса.

#### Scenario: Публикация web из CLI

- **WHEN** выполнена команда с `--platform react`, архивом web-плагина и `--apply`
- **THEN** CLI MUST отправить запрос в `/api/admin/web-preview/plugin-builds?dryRun=false` и напечатать `buildId` и статус

#### Scenario: Архив Compose с платформой react

- **WHEN** с `--platform react` передан архив, manifest которого содержит `platform: compose`
- **THEN** CLI MUST завершиться ошибкой без запроса к серверу

### Requirement: Gateway пропускает публикацию web как публикацию Compose

Gateway SHALL проксировать `POST /api/admin/web-preview/plugin-builds` в ds-service с теми же правилами, что публикацию Compose: только токен пользователя (ключ проекта получает `401`), роль публикации и признак системного администратора передаются доверенными заголовками, лимит тела 64 МБ. Маршрут описан в `nginx.local.conf` и `nginx.prod.conf.template` и проверяется `test-route-namespaces.sh`; как и публикация Compose, он не входит в публичный OpenAPI и `contracts/route-manifest.json`, где описан только `GET /api/ds/web-preview/plugin`.

#### Scenario: Ключ проекта

- **WHEN** публикация web отправлена с ключом проекта
- **THEN** gateway MUST ответить `401`

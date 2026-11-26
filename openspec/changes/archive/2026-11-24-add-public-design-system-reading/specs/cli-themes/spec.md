## MODIFIED Requirements

### Requirement: CLI theme fetch command

CLI SHALL предоставлять `theme fetch` для загрузки тем, метаданных и значений токенов в локальную `.sdds`. Доступ SHALL использовать общий выбор PAT/OAuth либо разрешённое анонимное чтение независимо от источника контекста.

#### Scenario: Theme fetch использует project-scoped context

- **WHEN** пользователь запускает `dsbuilder theme fetch` в настроенном локальном проекте
- **THEN** CLI MUST разрешить ближайшую `.sdds/config.json`, API URL и учётные данные через общие сценарии
- **AND** MUST использовать `projectId` и `designSystemId` выбранного контекста
- **AND** MUST передать выбранный PAT/OAuth через Bearer либо выполнить разрешённое анонимное чтение без `Authorization`
- **AND** MUST NOT выводить секреты

#### Scenario: Theme fetch принимает runtime overrides

- **WHEN** в режиме `auto` пользователь передаёт `theme fetch --api-key <secret>`
- **THEN** CLI MUST использовать этот PAT с наивысшим приоритетом
- **AND** MUST разрешить API URL по общей политике независимо от PAT
- **AND** MUST NOT записывать PAT или API URL в `.sdds/config.json`

#### Scenario: Theme fetch с user session

- **WHEN** конфигурация выбирает `user-session` и доступна подходящая OAuth-сессия
- **THEN** все запросы MUST использовать OAuth access token без требования PAT

#### Scenario: Theme fetch по ссылке без локального config

- **WHEN** пользователь передаёт `--design-system <uri> --destination <directory>` вне настроенного проекта
- **THEN** CLI MUST загрузить выбранную дизайн-систему в `<directory>/.sdds`
- **AND** MUST создать конфигурацию с идентификаторами проекта/дизайн-системы и ссылкой на источник учётных данных без секретов
- **AND** MUST NOT перезаписывать существующую конфигурацию назначения
- **AND** выбор авторизации MUST использовать `auto`: `--api-key`, `DSBUILDER_API_KEY` процесса, затем OAuth-сессию, а при отсутствии источников — разрешённое анонимное чтение без чтения постороннего `.env`

#### Scenario: Theme fetch по ссылке без destination

- **WHEN** ссылка передана вне настроенного проекта без `--destination`
- **THEN** команда MUST сообщить о необходимом каталоге назначения до сетевых запросов

#### Scenario: Сервер отклонил PAT

- **WHEN** запрос с PAT получает `401` или `403`
- **THEN** CLI MUST вернуть `PAT_INVALID` или `FORBIDDEN` без смены пользователя, обновления OAuth-сессии и повтора с другими учётными данными

#### Scenario: Локальный проект создан без входа
- **WHEN** гостевой `init` создал конфигурацию с `credential.type=auto`, а PAT и сессия отсутствуют
- **THEN** `theme fetch` MUST читать публикацию явно выбранной публичной ДС без входа и без запроса каталогов

### Requirement: Theme fetch backend contract

CLI `theme fetch` SHALL load remote data through the DS Builder project-scoped backend API.

#### Scenario: Theme fetch загружает tenants и tokens

- **WHEN** developer runs `dsbuilder theme fetch`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/design-systems/{designSystemId}/tenants`
- **THEN** CLI MUST parse the response as a JSON array of `Tenant` objects with fields `id`, `designSystemId`, `name`, `description`, `createdAt`, and `updatedAt`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/design-systems/{designSystemId}/tokens`
- **THEN** CLI MUST parse the response as a JSON array of `Token` objects with fields `id`, `designSystemId`, `name`, `type`, `displayName`, `description`, `enabled`, `createdAt`, and `updatedAt`

#### Scenario: Необязательные подпись и описание токена

- **WHEN** backend возвращает `displayName: null` или `description: null` для токена
- **THEN** `theme fetch` MUST использовать `name` как локальный `displayName` и пустую строку как локальный `description`

#### Scenario: Theme fetch загружает palette

- **WHEN** developer runs `dsbuilder theme fetch`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/design-systems/{designSystemId}/palette`
- **THEN** CLI MUST parse the response as a JSON array of `PaletteItem` objects with fields `id`, `type`, `shade`, `saturation`, `value`, `createdAt`, and `updatedAt`

#### Scenario: Theme fetch загружает token values для каждого tenant

- **WHEN** tenants response contains tenant with `id = tenant-a`
- **THEN** CLI MUST send `GET /api/projects/{projectId}/design-systems/{designSystemId}/tenants/tenant-a/token-values`
- **THEN** CLI MUST parse the response as a JSON array of `TokenValue` objects with fields `id`, `tokenId`, `tenantId`, `paletteId`, `platform`, `mode`, `value`, `createdAt`, and `updatedAt` and optional field `paletteRef`

#### Scenario: Цвет токена вычислен по палитре темы

- **WHEN** backend возвращает цветовое значение с `value = ["#0A8F7ACC"]` и `paletteRef = "[general.green.500][0.8]"`
- **THEN** CLI MUST записать `"#0A8F7ACC"` как значение токена
- **THEN** CLI MUST NOT заменять это значение по `.sdds/tenants/palette.json`

#### Scenario: Backend response cannot be parsed

- **WHEN** backend returns success status with JSON that cannot be parsed according to the expected DTO contract
- **THEN** CLI MUST return deterministic failure output
- **THEN** CLI MUST NOT write partial theme files
- **THEN** CLI MUST NOT print the raw API key


## ADDED Requirements

### Requirement: Загрузка тем публичной опубликованной версии
`theme fetch` SHALL допускать анонимное чтение явно выбранной публичной ДС. Первый разрешённый предметный запрос MUST сообщить фактическую публикацию, после чего команда MUST использовать её versionId в зависимых запросах тем, токенов, значений и определений палитры без обязательного чтения карточки.

#### Scenario: Публикация меняется во время загрузки
- **WHEN** первый разрешённый предметный ответ выбрал публикацию A, а до запроса значений опубликована B
- **THEN** все загруженные темы и значения MUST остаться в A
- **THEN** существующие правила локальных файлов и защиты назначения MUST сохраняться

#### Scenario: Глобальная палитра для публичной загрузки
- **WHEN** публичная загрузка требует определения палитры через маршрут `/{designSystemId}/palette`
- **THEN** запрос MUST передать ID ДС в пути и закреплённую опубликованную границу без query-контекста общего каталога
- **THEN** ответ MUST NOT раскрывать определения, не используемые этой границей

#### Scenario: Приватная ДС
- **WHEN** анонимная загрузка не получает доступную опубликованную ДС
- **THEN** команда MUST завершиться ошибкой без частичной записи

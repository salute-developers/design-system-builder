## ADDED Requirements

### Requirement: Project-scoped endpoint приема bundle
Gateway SHALL предоставлять `POST /api/projects/{projectId}/documentation/bundles`, защищать его существующей project-scoped аутентификацией и направлять запрос в новый documentation service как `POST /documentation/bundles` вместе с trusted actor/project context.

#### Scenario: Gateway направляет upload в documentation service
- **WHEN** аутентифицированный клиент отправляет `POST /api/projects/project-a/documentation/bundles`
- **THEN** Gateway SHALL проверить доступ actor к `project-a`
- **AND** Gateway SHALL передать запрос новому documentation service по внутреннему пути `/documentation/bundles`
- **AND** Gateway SHALL явно заменить client-provided `X-Actor-*` и `X-Project-*` headers значениями Auth Helper

#### Scenario: Существующий docs route остается независимым
- **WHEN** клиент обращается к `/api/projects/project-a/docs/...`
- **THEN** Gateway SHALL продолжить направлять запрос в существующий `docs_service_api`
- **AND** новый documentation route SHALL NOT изменять rewrite или upstream существующего route

### Requirement: Авторизация публикации документации
Documentation service MUST разрешать публикацию user actor с project role `owner`, `maintainer` или `editor` и MUST разрешать публикацию любому валидному project-bound access key, который Gateway связал с project из route.

#### Scenario: Owner публикует bundle
- **WHEN** сервис получает trusted actor context с `actorType = user` и `projectRole = owner`
- **THEN** сервис SHALL разрешить продолжить прием bundle

#### Scenario: Maintainer публикует bundle
- **WHEN** сервис получает trusted actor context с `actorType = user` и `projectRole = maintainer`
- **THEN** сервис SHALL разрешить продолжить прием bundle

#### Scenario: Editor публикует bundle
- **WHEN** сервис получает trusted actor context с `actorType = user` и `projectRole = editor`
- **THEN** сервис SHALL разрешить продолжить прием bundle

#### Scenario: Viewer не может публиковать bundle
- **WHEN** сервис получает trusted actor context пользователя с ролью `viewer`
- **THEN** сервис MUST вернуть `403 Forbidden`
- **AND** сервис MUST NOT сохранять bundle или создавать ingestion job

#### Scenario: Project key публикует без проверки scopes
- **WHEN** сервис получает trusted actor context с `actorType = project_key` и совпадающим trusted `projectId`
- **THEN** сервис SHALL разрешить продолжить прием bundle независимо от `X-Project-Scopes`

#### Scenario: Trusted context отсутствует
- **WHEN** upload поступает без обязательного trusted actor/project context
- **THEN** сервис MUST отклонить запрос
- **AND** сервис MUST NOT доверять одноименным headers, не прошедшим через Gateway

### Requirement: Multipart contract для tar.gz
Endpoint MUST принимать `multipart/form-data` с ровно одной file part `bundle`, содержащей gzip-сжатый USTAR archive. ZIP и другие archive formats SHALL NOT поддерживаться в первой версии.

#### Scenario: Валидная bundle part
- **WHEN** запрос содержит одну file part `bundle` с валидным gzip/USTAR payload
- **THEN** сервис SHALL потоково принять archive без загрузки полного файла в память

#### Scenario: Bundle part отсутствует или повторяется
- **WHEN** multipart request не содержит part `bundle` либо содержит несколько parts с таким именем
- **THEN** сервис MUST вернуть `400 Bad Request`
- **AND** сервис MUST NOT создавать bundle или job

#### Scenario: Формат определяется по содержимому
- **WHEN** filename или `Content-Type` заявляет `tar.gz`, но payload не является валидным gzip-сжатым USTAR archive
- **THEN** сервис MUST отклонить payload независимо от filename и media type

#### Scenario: ZIP archive не поддерживается
- **WHEN** part `bundle` содержит ZIP archive
- **THEN** сервис MUST вернуть `415 Unsupported Media Type`

### Requirement: Ограниченное и безопасное чтение archive
Сервис MUST применять конфигурируемые limits к compressed и uncompressed данным и MUST проверять безопасность каждого TAR entry без извлечения entries на файловую систему.

#### Scenario: Превышен compressed limit
- **WHEN** размер принятого compressed payload превышает configured limit
- **THEN** сервис MUST прервать прием и вернуть `413 Payload Too Large`
- **AND** сервис MUST удалить временные данные запроса

#### Scenario: Archive является decompression bomb
- **WHEN** суммарный uncompressed size, размер entry или число entries превышает соответствующий configured limit
- **THEN** сервис MUST прекратить чтение archive и вернуть `413 Payload Too Large`

#### Scenario: Archive содержит небезопасный path
- **WHEN** TAR entry содержит absolute path, `..`, NUL или duplicate normalized path
- **THEN** сервис MUST отклонить archive
- **AND** диагностика SHALL содержать только bundle-relative path

#### Scenario: Archive содержит link или special entry
- **WHEN** TAR archive содержит symbolic link, hard link, device или иной entry, не являющийся regular file или directory
- **THEN** сервис MUST отклонить archive

### Requirement: Приемочная валидация manifest v1
Сервис MUST найти единственный root-level `manifest.json`, разобрать его как UTF-8 JSON и проверить минимальный package contract до сохранения bundle.

#### Scenario: Manifest поддерживаемой версии принят
- **WHEN** `manifest.json` содержит `schemaVersion = "1.0"`, непустые `designSystem.id`, `designSystem.version`, `platform` и поддерживаемые artifacts
- **THEN** сервис SHALL продолжить приемочную валидацию

#### Scenario: Manifest отсутствует или расположен не в корне
- **WHEN** archive не содержит root-level `manifest.json`
- **THEN** сервис MUST отклонить archive
- **AND** сервис MUST NOT создавать ingestion job

#### Scenario: Schema version не поддерживается
- **WHEN** `manifest.json` содержит неизвестный `schemaVersion`
- **THEN** сервис MUST вернуть `422 Unprocessable Entity` со стабильным machine-readable error code

#### Scenario: Resolved docs contract отсутствует
- **WHEN** manifest не объявляет `RESOLVED_DOCS` с path `docs.json` и format `dsb-resolved-docs-v1`
- **THEN** сервис MUST вернуть `422 Unprocessable Entity`

#### Scenario: Объявленный artifact отсутствует
- **WHEN** manifest объявляет file или directory artifact, которого нет в archive
- **THEN** сервис MUST вернуть acceptance diagnostic с code `MISSING_ARTIFACT` и bundle-relative artifact path

#### Scenario: Дополнительный файл разрешен
- **WHEN** archive содержит безопасный файл, не объявленный отдельным artifact в manifest, например `meta/samples.json`
- **THEN** сервис SHALL NOT отклонять archive только из-за наличия этого файла

#### Scenario: Глубокая валидация отложена
- **WHEN** manifest проходит приемочную валидацию
- **THEN** upload endpoint SHALL NOT парсить `docs.json`, markdown или info-artifacts для семантической валидации

### Requirement: Проверка design system в project
До сохранения bundle сервис MUST проверить, что `manifest.designSystem.id` доступен в trusted project context, вызвав db-service `GET /api/ds/design-systems/{designSystemId}` с полученными от Gateway trusted headers.

#### Scenario: Design system принадлежит project
- **WHEN** db-service успешно возвращает design system для `manifest.designSystem.id` и trusted `X-Project-Id`
- **THEN** сервис SHALL продолжить сохранение bundle

#### Scenario: Design system не найдена в project
- **WHEN** db-service возвращает `404` для пары trusted project/design system
- **THEN** сервис MUST вернуть `404 Not Found` с code `DESIGN_SYSTEM_NOT_FOUND`
- **AND** сообщение MUST NOT раскрывать, существует ли design system в другом project
- **AND** bundle/job MUST NOT быть созданы

#### Scenario: Db-service временно недоступен
- **WHEN** ownership request завершается timeout или ответом `5xx`
- **THEN** сервис MUST вернуть `503 Service Unavailable`
- **AND** bundle/job MUST NOT быть созданы

### Requirement: Immutable raw bundle и metadata
После успешной авторизации, приемочной валидации и ownership-проверки сервис MUST сохранить исходный `tar.gz` byte-for-byte в configured S3-compatible bucket и MUST записать его metadata отдельно от содержимого archive.

#### Scenario: Raw bundle сохранен
- **WHEN** все синхронные проверки успешно завершены
- **THEN** сервис SHALL выполнить S3 `PutObject` исходных compressed bytes по уникальному object key, включающему trusted `projectId` и новый `bundleId`
- **AND** сервис SHALL сохранить bucket, object key, SHA-256, compressed/uncompressed sizes, manifest snapshot, actor audit context и время загрузки

#### Scenario: S3 временно недоступен
- **WHEN** S3 `PutObject` завершается timeout или server error
- **THEN** сервис MUST вернуть `503 Service Unavailable`
- **AND** database transaction создания bundle/job MUST NOT начинаться

#### Scenario: Повторная загрузка одинакового archive
- **WHEN** клиент повторно загружает archive с тем же SHA-256 без согласованного idempotency contract
- **THEN** сервис SHALL создать новый bundle с новым `bundleId`
- **AND** ранее сохраненный raw bundle MUST NOT быть перезаписан

#### Scenario: Persistence завершается ошибкой
- **WHEN** S3 object сохранен, но database transaction не может создать metadata и job
- **THEN** сервис MUST отдельным чтением проверить наличие committed bundle metadata
- **AND** сервис MUST попытаться удалить сохраненный object через S3 `DeleteObject` только если отсутствие metadata подтверждено
- **AND** при подтвержденном commit сервис MUST сохранить object и вернуть успешный результат с ранее сгенерированными identifiers
- **AND** при недоступной проверке сервис MUST сохранить object для последующей reconciliation
- **AND** при подтвержденном отсутствии metadata или недоступной проверке сервис MUST NOT возвращать успешный ответ

### Requirement: S3 configuration и readiness
Documentation service MUST получать endpoint, region, bucket, credentials, path-style mode, prefix и timeouts S3 client из environment/application configuration и MUST проверять доступность configured bucket без автоматического создания production bucket.

#### Scenario: Local MinIO bucket подготовлен
- **WHEN** root `docker-compose.local.yml` запускает local stack
- **THEN** MinIO init service SHALL создать configured documentation bucket до readiness documentation service

#### Scenario: Production bucket доступен
- **WHEN** documentation service запускается с production S3 configuration
- **THEN** readiness check SHALL выполнить `HeadBucket` для заранее созданного bucket
- **AND** credentials MUST NOT попадать в logs или database

#### Scenario: Bucket недоступен
- **WHEN** configured bucket отсутствует или S3 credentials не позволяют выполнить `HeadBucket`
- **THEN** readiness check MUST сообщить, что service не готов принимать traffic

### Requirement: Создание ingestion job в accepted
Сервис MUST атомарно создать metadata bundle и связанную ingestion job со статусом `accepted`; в рамках этой capability job MUST NOT автоматически переходить в дальнейшие ingestion states.

#### Scenario: Bundle принят
- **WHEN** raw bundle сохранен и database transaction успешно завершена
- **THEN** сервис MUST вернуть `202 Accepted`
- **AND** response DTO SHALL содержать `bundleId`, `jobId` и `status = "accepted"`

#### Scenario: Worker не запускается
- **WHEN** ingestion job создана в рамках upload endpoint
- **THEN** сервис SHALL оставить ее в статусе `accepted`
- **AND** сервис SHALL NOT запускать глубокую валидацию, нормализацию, индексацию или публикацию

### Requirement: Безопасная диагностика приема
Все ошибки upload endpoint MUST использовать стабильные machine-readable codes и MUST NOT раскрывать server filesystem paths, credentials, internal URLs или содержимое archive.

#### Scenario: Acceptance validation возвращает структурированные ошибки
- **WHEN** archive или manifest нарушает приемочный контракт
- **THEN** JSON response SHALL содержать массив `errors`
- **AND** каждая ошибка SHALL содержать `code`, `message` и опциональный bundle-relative `path`

#### Scenario: Внутренняя ошибка не раскрывает инфраструктуру
- **WHEN** storage, database или downstream request завершается внутренней ошибкой
- **THEN** публичный response MUST NOT содержать stack trace, JDBC URL, storage root, credential или внутренний db-service URL

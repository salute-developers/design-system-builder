## 1. Scaffold и build configuration

- [x] 1.1 Проверить применимые Gradle conventions в `build-system` и создать included build `documentation-service` с модулями `app` и `feature-ingestion`.
- [x] 1.2 Подключить `documentation-service` в корневой `settings.gradle.kts` и настроить package namespace `com.dsbuilder`.
- [x] 1.3 Добавить зависимости Ktor, Koin, kotlinx.serialization, Exposed/PostgreSQL, TAR reader и тестовые зависимости через общий version catalog/conventions.
- [x] 1.4 Создать Ktor bootstrap, JSON serialization, routing aggregation, Koin startup и `/health` endpoint в `documentation-service/app`.

## 2. Domain и application contracts

- [x] 2.1 Добавить domain value objects и модели `DocumentationBundle`, `IngestionJob`, `IngestionStatus.ACCEPTED`, `Manifest`, `ArtifactDeclaration`, `ActorContext` и `AcceptanceDiagnostic`.
- [x] 2.2 Зафиксировать manifest v1 enums и formats, совместимые с фактическим CLI bundle: `RESOLVED_DOCS`, `CONTENT_ROOT`, `API_DOCS`, `COMPONENTS_INFO`, `THEME_INFO`, `SCREENSHOTS`, `CODE_EXAMPLES`.
- [x] 2.3 Добавить application ports `BundleArchiveInspector`, `DesignSystemOwnershipVerifier`, `RawBundleStorage`, bundle/job repositories, `TransactionManager`, `Clock` и `IdGenerator` без инфраструктурных типов.
- [x] 2.4 Реализовать policy публикации для `owner`, `maintainer`, `editor` и любого валидного `project_key`, включая отказ `viewer` и некорректного trusted context.
- [x] 2.5 Реализовать `AcceptDocumentationBundleUseCase`: authorization, inspection, ownership lookup, immutable storage, транзакционное создание bundle/job и compensating cleanup.
- [x] 2.6 Добавить unit-тесты use case для успешного приема, всех actor policies, ownership failures, persistence failure/cleanup и повторной загрузки одинакового SHA-256.

## 3. Потоковая загрузка и archive inspection

- [x] 3.1 Реализовать bounded streaming compressed upload во временный файл с одновременным SHA-256 и гарантированным cleanup.
- [x] 3.2 Реализовать `tar.gz` inspector через `GZIPInputStream` и выбранный TAR reader без извлечения entries на filesystem.
- [x] 3.3 Добавить конфигурируемые limits для compressed size, total uncompressed size, entry size/count/path length и `manifest.json` size с безопасными defaults из design.
- [x] 3.4 Реализовать нормализацию archive paths и отказ для absolute/traversal/NUL/duplicate paths, links, devices, special entries и поврежденных TAR/gzip streams.
- [x] 3.5 Реализовать явные manifest input DTO, UTF-8/JSON decoding и acceptance validation schema `1.0`, обязательного `RESOLVED_DOCS` и объявленных file/directory artifacts.
- [x] 3.6 Разрешить безопасные дополнительные archive files, не объявленные отдельными artifacts, и не выполнять глубокую валидацию `docs.json`/content.
- [x] 3.7 Добавить unit/contract tests для валидного USTAR+gzip, ZIP rejection, decompression limits, unsafe entries, duplicate paths, manifest/artifact ошибок и `meta/samples.json`.
- [x] 3.8 Проверить inspector на приложенном реальном `docs-bundle.tar.gz` и зафиксировать малый воспроизводимый contract fixture для автоматических тестов.

## 4. Db-service ownership adapter

- [x] 4.1 Добавить конфигурацию `DB_SERVICE_BASE_URL` и connect/request timeouts в `documentation-service/app`.
- [x] 4.2 Реализовать HTTP adapter для `GET /api/ds/design-systems/{designSystemId}` с передачей trusted `X-Actor-*` и `X-Project-*` context без пользовательского `Authorization` header.
- [x] 4.3 Преобразовать success, `404`, `401`/`403`, timeout и `5xx` db-service в domain/application results и безопасные HTTP errors.
- [x] 4.4 Добавить Ktor MockEngine tests для URL, trusted headers, успешного ownership lookup и каждого failure mapping.

## 5. PostgreSQL persistence и raw storage

- [x] 5.1 Создать PostgreSQL tables/migration для `documentation_bundles` и `ingestion_jobs` с foreign key, indexes и сохранением manifest JSON/audit metadata.
- [x] 5.2 Реализовать Exposed repositories и transaction manager с атомарным созданием bundle metadata и job в статусе `accepted`.
- [x] 5.3 Реализовать S3-compatible `RawBundleStorage` с `PutObject` из temporary file, уникальным object key, SHA-256 metadata и защитой от overwrite.
- [x] 5.4 Добавить конфигурацию S3 endpoint, region, bucket, credentials, path-style mode, prefix и timeouts; реализовать `HeadBucket` readiness без автоматического создания production bucket.
- [x] 5.5 Реализовать read-back committed metadata и compensating S3 `DeleteObject` только при подтвержденном rollback, а также безопасный cleanup временных файлов при всех failure paths.
- [x] 5.6 Добавить repository integration tests на PostgreSQL и MinIO integration tests для `PutObject`, immutable key, duplicate checksum/new id, `HeadBucket` и compensating cleanup.

## 6. REST presentation

- [x] 6.1 Добавить internal Ktor route `POST /documentation/bundles` и потоковый multipart parser, принимающий ровно одну file part `bundle`.
- [x] 6.2 Реализовать mapping trusted headers в `ActorContext` с проверкой обязательных полей и без доверия к metadata из multipart.
- [x] 6.3 Добавить явные success/error DTO: `202 {bundleId, jobId, status}` и `{errors:[{code,message,path?}]}`.
- [x] 6.4 Реализовать status mapping для `400`, `403`, `404`, `413`, `415`, `422` и `503` без утечки server paths, credentials, stack traces и internal URLs.
- [x] 6.5 Добавить Ktor route tests для валидного upload, отсутствующей/duplicate part, role/key authorization, malformed archive, limits, manifest errors, ownership failure и successful `accepted` response.

## 7. Gateway integration

- [x] 7.1 Добавить отдельный `documentation_service_api` upstream и `DOCUMENTATION_SERVICE_UPSTREAM_*` variables в local и production nginx configuration.
- [x] 7.2 Добавить project-scoped location `/api/projects/{projectId}/documentation/...` с `auth_request /_auth_project`, trusted header replacement и rewrite в `/documentation/...`.
- [x] 7.3 Сохранить без изменений `/api/projects/{projectId}/docs/... -> docs_service_api` и добавить gateway regression test/smoke check для обоих независимых namespaces.
- [x] 7.4 Настроить `client_max_body_size`, proxy buffering/timeouts и JSON error behavior согласованно с configured compressed upload limit.
- [x] 7.5 Добавить новые upstream variables в root production/local compose/env templates и `envsubst` allow-list без секретных значений.

## 8. Production и local runtime

- [x] 8.1 Добавить `documentation-service/app/Dockerfile` с production entrypoint и non-root runtime user.
- [x] 8.2 Подключить `documentation-service`, `documentation-db`, `minio` и одноразовый `minio-init` для создания bucket в корневой `docker-compose.local.yml` с healthchecks и локальными non-secret defaults.
- [x] 8.3 Подключить `documentation-service` в корневой `docker-compose.prod.yml` с external PostgreSQL/S3 env settings, внутренним `expose`, healthcheck и без локального MinIO.
- [x] 8.4 Добавить `application.yaml`/env configuration для port, JDBC, temporary directory, db-service, S3 client/bucket, timeouts и archive limits.
- [x] 8.5 Обновить gateway `depends_on` и общие Compose env templates так, чтобы traffic направлялся только в healthy documentation service; не публиковать service port наружу в production.
- [x] 8.6 Добавить структурированные логи acceptance result с request id, project/design-system id и стабильным error code без archive content или credentials.

## 9. End-to-end verification

- [x] 9.1 Выполнить `documentation-service` unit/integration tests, `detekt`, `spotlessCheck` и `build`; при formatting-only ошибках применить `spotlessApply` и повторить проверки.
- [x] 9.2 Выполнить `identity-gateway` tests, `detekt`, `spotlessCheck` и `build` после nginx/compose изменений.
- [x] 9.3 Выполнить корневой `./gradlew build` для проверки composite build integration.
- [x] 9.4 Провести smoke upload приложенного реального `docs-bundle.tar.gz` через `/api/projects/{projectId}/documentation/bundles` и проверить `202`, byte-for-byte S3 object, database metadata и job `accepted`.
- [x] 9.5 Провести positive smoke case для editor и negative smoke cases для viewer, отсутствующей design system, ZIP, unsafe TAR path и превышения configured limit.
- [x] 9.6 Убедиться, что существующие `/api/projects/{projectId}/docs/...` и `/api/projects/{projectId}/ds/...` маршруты продолжают работать без изменения поведения.

## Context

ADR-0002 разделяет синхронный прием пакета документации и последующий асинхронный ingestion pipeline. DS Builder CLI уже создает фактический пакет как gzip-сжатый POSIX USTAR archive с файлами `manifest.json`, `docs.json`, `content/`, `meta/` и `assets/`, однако `docs publish` пока использует HTTP-заглушку, а backend-сервис приема отсутствует.

В `identity-gateway` уже существуют два соседних project-scoped namespace:

- `/api/projects/{projectId}/ds/...` переписывается в `/api/ds/...` и направляется в db-service;
- `/api/projects/{projectId}/docs/...` направляется в существующий `docs_service_api`, который не является новым сервисом документации и должен остаться без изменений.

Новый сервис должен использовать отдельный namespace `/api/projects/{projectId}/documentation/...` и отдельный upstream. Gateway аутентифицирует actor и передает downstream доверенные `X-Actor-*` и `X-Project-*` headers. Связь design system с проектом проверяется через существующий db-service endpoint после того же rewrite, который применяется для CLI: `GET /api/ds/design-systems/{designSystemId}` с `X-Project-Id` и остальным trusted actor context.

Первый этап заканчивается после сохранения immutable raw bundle и создания `IngestionJob(status = accepted)`. Отдельный worker пока отсутствует, поэтому job намеренно не переходит в следующие состояния.

## Goals / Non-Goals

**Goals:**

- создать отдельный deployable `documentation-service` в текущем Kotlin/Gradle mono-repo;
- принять реальный `tar.gz` package contract DS Builder CLI через project-scoped REST API;
- ограничить память и ресурсы при загрузке и безопасно проверить структуру архива;
- синхронно проверить manifest v1 и принадлежность design system проекту;
- сохранить исходный archive для воспроизводимости и создать диагностируемые metadata bundle/job;
- сохранить архитектурные границы `presentation -> application -> domain`, вынеся HTTP, archive parsing, db-service и persistence adapters в `data`/`presentation`;
- обеспечить локальный и production runtime contract через Docker, PostgreSQL, S3-compatible storage, env-конфигурацию и healthcheck в корневых Compose-файлах.

**Non-Goals:**

- глубокая валидация `docs.json`, markdown, assets, `components-info` и `theme-info`;
- распаковка и нормализованное хранение content/assets;
- worker, scheduler и переходы job после `accepted`;
- API получения job status, публикаций, страниц, assets, поиска и базы знаний;
- embeddings, PostgreSQL FTS, `pgvector` и атомарное переключение активной публикации;
- отдельные scopes `documentation:publish` или `docs:publish` для project access keys;
- идемпотентность HTTP-запроса и deduplication одинаковых архивов;
- изменение или удаление существующего `/api/projects/{projectId}/docs/...`.

## Decisions

### 1. Новый included build `documentation-service`

Сервис создается как отдельный included build с модулями:

```text
documentation-service/
├── app/
└── feature-ingestion/
    └── src/main/kotlin/com/dsbuilder/documentation/ingestion/
        ├── presentation/
        ├── application/
        ├── domain/
        ├── data/
        └── di/
```

`app` содержит Ktor bootstrap, serialization, configuration, routing aggregation, DI и runtime files. `feature-ingestion` содержит единственную бизнес-фичу первого этапа. Отдельный `core` пока не создается: общего кода между несколькими feature-модулями еще нет.

Альтернатива — добавить ingestion в `project-publisher`. Она отклонена, потому что публикация package artifacts и жизненный цикл документационной базы знаний имеют разные доменные модели, storage profile и будущие runtime-компоненты.

### 2. Отдельный gateway namespace и upstream

Gateway принимает:

```http
POST /api/projects/{projectId}/documentation/bundles
```

и переписывает его в:

```http
POST /documentation/bundles
```

для нового `documentation_service_api`. Добавляются отдельные `DOCUMENTATION_SERVICE_UPSTREAM_SCHEME`, `DOCUMENTATION_SERVICE_UPSTREAM_HOST` и `DOCUMENTATION_SERVICE_UPSTREAM_PORT`. Существующий `/docs/... -> docs_service_api` сохраняется.

Новый location повторяет текущий project-scoped auth flow: `auth_request /_auth_project`, получение trusted headers из Auth Helper и явная перезапись входных `X-Actor-*`/`X-Project-*` значений перед proxy. Это не позволяет клиенту подменить trusted context.

Альтернатива — разместить endpoint под `/docs/...`. Она отклонена из-за конфликта владения namespace с существующим сервисом.

### 3. Multipart и формат archive

Endpoint принимает `multipart/form-data` с ровно одной file part:

```text
name: bundle
filename: *.tar.gz
Content-Type: application/gzip
```

Сервис проверяет gzip magic bytes и USTAR structure, поэтому filename и client-provided media type не считаются доказательством формата. ZIP не поддерживается. Metadata не дублируется multipart-полями: `projectId` берется из trusted header, а `designSystemId`, `version` и `platform` — из `manifest.json`.

Альтернатива — отправлять archive как raw request body. Multipart выбран для совместимости с запланированным CLI contract и явного именования загружаемого файла.

### 4. Bounded upload и безопасное чтение USTAR/gzip

Presentation adapter потоково копирует compressed body во временный файл, одновременно считая compressed bytes и SHA-256. Archive не загружается целиком в память. После завершения upload data adapter повторно читает временный файл через `GZIPInputStream` и TAR reader, применяя конфигурируемые ограничения:

- максимальный compressed HTTP payload: `100 MiB`;
- максимальный суммарный uncompressed size: `500 MiB`;
- максимальный размер одного entry: `100 MiB`;
- максимальное число entries: `20_000`;
- максимальная длина archive path: `255` bytes;
- максимальный размер `manifest.json`: `1 MiB`.

Archive reader запрещает absolute paths, `..` segments, NUL, duplicate normalized paths, symbolic links, hard links, devices и другие non-file/non-directory entries. Проверяются TAR headers и преждевременное завершение stream. Все пути нормализуются как bundle-relative POSIX paths без извлечения на файловую систему.

Для TAR используется JVM-библиотека с потоковым API, например Apache Commons Compress; конкретные типы остаются внутри `data`. Самописный USTAR parser отклонен из-за высокой цены ошибок в security-sensitive коде.

### 5. Приемочная валидация manifest v1

Archive должен содержать ровно один root-level `manifest.json`. Он декодируется как UTF-8 JSON в явный input DTO и преобразуется во внутреннюю модель.

Поддерживаемый контракт:

- `schemaVersion == "1.0"`;
- непустые `designSystem.id`, `designSystem.version` и `platform`;
- известные artifact types: `RESOLVED_DOCS`, `CONTENT_ROOT`, `API_DOCS`, `COMPONENTS_INFO`, `THEME_INFO`, `SCREENSHOTS`, `CODE_EXAMPLES`;
- artifact `RESOLVED_DOCS` существует, имеет path `docs.json` и format `dsb-resolved-docs-v1`;
- каждый объявленный file artifact существует как file entry;
- каждый объявленный directory artifact имеет безопасный path с `/` и представлен directory entry или хотя бы одним дочерним entry;
- дополнительные файлы разрешены: фактический CLI bundle содержит, например, не объявленный отдельно `meta/samples.json`.

Приемочная валидация не парсит `docs.json` и не проверяет `contentRefs`: эти операции относятся к будущей глубокой валидации.

### 6. Авторизация внутри documentation service

Gateway подтверждает actor и project membership/key binding, но бизнес-разрешение на публикацию проверяет сервис:

```text
user + owner       -> allow
user + maintainer  -> allow
user + editor      -> allow
user + viewer      -> deny
project_key        -> allow
```

В первой версии любой валидный project-bound key может публиковать в своем проекте; `X-Project-Scopes` сохраняется в request context, но не участвует в решении. Это временно отражает текущую модель db-service, который также не проверяет scopes access key для design-system lookup.

Сервис отклоняет запрос, если обязательные trusted headers отсутствуют, противоречат друг другу или actor type неизвестен. Прямой runtime port должен быть доступен только внутри доверенной сети; публичная точка входа — gateway.

### 7. Проверка ownership через db-service

После разбора manifest application use case вызывает port `DesignSystemOwnershipVerifier`. HTTP adapter выполняет:

```http
GET {DB_SERVICE_BASE_URL}/api/ds/design-systems/{designSystemId}
X-Project-Id: {trustedProjectId}
X-Actor-Type: ...
X-User-Id: ...
X-Project-Role: ...
X-Project-Key-Id: ...
X-Project-Scopes: ...
X-System-Admin: ...
```

Adapter передает trusted context, уже полученный от gateway, и не использует пользовательский `Authorization` header. Успешный ответ подтверждает связь; `404` преобразуется в стабильную acceptance error `DESIGN_SYSTEM_NOT_FOUND`, одинаковую для отсутствующей и чужой design system. `401`/`403` преобразуются в отказ доступа, а timeout/`5xx` — в `503 Service Unavailable`; bundle/job при этом не создаются.

Альтернатива — повторный вызов публичного gateway route. Она отклонена, потому что создает proxy loop, требует повторной аутентификации и связывает внутренний adapter с public URL topology.

### 8. Domain/application orchestration

Основной use case `AcceptDocumentationBundleUseCase` зависит от ports, а не от Ktor, TAR library, Exposed или filesystem API:

```text
BundleArchiveInspector
DesignSystemOwnershipVerifier
RawBundleStorage
DocumentationBundleRepository
IngestionJobRepository
TransactionManager
Clock / IdGenerator
```

Domain содержит value objects и модели `DocumentationBundle`, `IngestionJob`, `Manifest`, `ArtifactDeclaration`, `ActorContext`, `AcceptanceDiagnostic` и `IngestionStatus.ACCEPTED`. Presentation содержит multipart parsing, trusted-header DTO/mapping и HTTP response/error mapping. `data` содержит archive inspector, db-service client, S3 storage adapter и PostgreSQL repositories. `di` связывает реализации через Koin.

### 9. Metadata в PostgreSQL, raw bundle в S3-compatible storage

PostgreSQL хранит нормализованные metadata:

```text
documentation_bundles
  id, project_id, design_system_id, design_system_version,
  platform, schema_version, storage_key, sha256,
  compressed_size, uncompressed_size, original_filename,
  manifest_json, actor_type, actor_id, uploaded_at

ingestion_jobs
  id, bundle_id, status, created_at
```

Raw archive хранится неизменяемо по ключу:

```text
projects/{projectId}/documentation/bundles/{bundleId}/bundle.tar.gz
```

В первой реализации `RawBundleStorage` использует S3-compatible API. HTTP upload сначала сохраняется во временный локальный файл только для bounded archive inspection. После успешных проверок S3 adapter потоково отправляет этот файл через `PutObject`; archive не преобразуется и сохраняется byte-for-byte. В PostgreSQL записываются bucket, object key, ETag/version id при наличии, SHA-256 и размеры.

S3 client конфигурируется через:

```text
DOCUMENTATION_S3_ENDPOINT
DOCUMENTATION_S3_REGION
DOCUMENTATION_S3_BUCKET
DOCUMENTATION_S3_ACCESS_KEY
DOCUMENTATION_S3_SECRET_KEY
DOCUMENTATION_S3_PATH_STYLE_ACCESS
DOCUMENTATION_S3_PREFIX
DOCUMENTATION_S3_CONNECT_TIMEOUT_MS
DOCUMENTATION_S3_REQUEST_TIMEOUT_MS
```

`DOCUMENTATION_S3_ENDPOINT` позволяет использовать MinIO или другой S3-compatible provider; для AWS S3 endpoint может быть пустым и определяется SDK по region. `DOCUMENTATION_S3_PATH_STYLE_ACCESS=true` используется локально с MinIO. Credentials поступают только через environment/secrets и не сохраняются в БД или логах. Production bucket создается инфраструктурой заранее; приложение выполняет `HeadBucket` при readiness check, но не создает и не меняет bucket policy.

Локальный root `docker-compose.local.yml` поднимает MinIO и одноразовый `minio-init`, который после readiness создает configured bucket. Это дает тот же S3 API, что и production, без отдельного filesystem adapter.

Для клиента используется AWS SDK for Java v2 S3 API либо эквивалентный JVM client с поддержкой endpoint override, path-style access, streaming upload из file path и `PutObject`/`DeleteObject`/`HeadBucket`. Конкретные SDK types остаются внутри `data`.

Альтернатива — хранить archive как PostgreSQL `bytea`. Она отклонена, чтобы не раздувать основную БД большими immutable файлами. Отдельный filesystem adapter также отклонен для первой версии, чтобы local и production environments проверяли одинаковую object-storage семантику.

### 10. Согласованность S3 и PostgreSQL

S3 и PostgreSQL не поддерживают общую транзакцию. Поэтому use case выполняет операции в следующем порядке:

```text
1. Принять multipart stream во временный локальный файл
2. Проверить tar.gz, manifest, authorization и ownership
3. Сгенерировать bundleId, jobId и уникальный final object key
4. Выполнить S3 PutObject из временного файла в final object key
5. В одной PostgreSQL transaction создать DocumentationBundle и IngestionJob(accepted)
6. Удалить временный локальный файл
```

Object key содержит случайный `bundleId`, а запись выполняется с защитой от overwrite, если client/SDK позволяет передать `If-None-Match: *`. Поэтому ранее принятый bundle не может быть заменен новым upload.

Если `PutObject` завершается ошибкой, DB transaction не начинается. Исключение на transaction boundary не доказывает rollback: PostgreSQL мог выполнить `COMMIT`, а соединение могло оборваться до получения подтверждения. Поэтому use case выполняет отдельный read-back по `bundleId`. При подтвержденном наличии metadata object сохраняется и операция считается принятой. `DeleteObject` выполняется только при подтвержденном отсутствии metadata. Если read-back недоступен, object сохраняется как reconciliation candidate; безопаснее временный orphan, чем committed metadata со ссылкой на удаленный object. Ошибка compensating delete логируется с `bundleId` и object key как orphan candidate, но не изменяет публичный failure response. Временный локальный файл удаляется в `finally` при любом исходе.

При process crash между `PutObject` и DB commit в S3 может остаться orphan object. Это осознанная модель eventual cleanup: object key уникален по `bundleId`, отсутствующая database row делает объект недоступным API, а отдельная будущая housekeeping operation сможет удалять objects старше safety interval, отсутствующие в `documentation_bundles`. Для первого upload endpoint автоматический scanner не вводится.

Каждый успешный запрос создает новый bundle и job, даже если SHA-256 совпадает. Idempotency и deduplication откладываются до появления реального retry contract CLI.

### 11. HTTP responses и диагностика

Успех возвращается как:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "bundleId": "bundle_...",
  "jobId": "job_...",
  "status": "accepted"
}
```

Приемочные ошибки имеют единый envelope:

```json
{
  "errors": [
    {
      "code": "MISSING_ARTIFACT",
      "path": "meta/components-info.json",
      "message": "Артефакт, объявленный в manifest.json, не найден."
    }
  ]
}
```

Основное отображение статусов:

- `400` — malformed multipart, отсутствующая/лишняя `bundle` part, поврежденный gzip/TAR или JSON;
- `403` — actor не имеет права publish;
- `404` — design system не найдена в trusted project context;
- `413` — превышен compressed или uncompressed limit;
- `415` — неподдерживаемый archive media/format;
- `422` — валидный archive с неподдерживаемым или противоречивым manifest contract;
- `503` — db-service, PostgreSQL или raw storage временно недоступны.

Диагностика содержит только bundle-relative paths и никогда не раскрывает server filesystem paths, credentials или внутренние URL.

### 12. Runtime, root Compose и наблюдаемость

`documentation-service/app` получает Dockerfile. Сервис подключается в оба общих runtime stack:

- root `docker-compose.local.yml` добавляет `documentation-service`, `documentation-db`, `minio` и `minio-init`; Gateway зависит от healthy documentation service, а сервис зависит от healthy PostgreSQL и завершившегося bucket init;
- root `docker-compose.prod.yml` добавляет `documentation-service` с external PostgreSQL и S3 settings из обязательных environment/secrets, `expose` внутреннего port и healthcheck; MinIO в production stack не добавляется.

Отдельный `documentation-service/app/docker-compose.local.yml` не создается: source of truth для интегрированного запуска — корневой Compose. Конфигурация включает runtime port, JDBC settings, db-service base URL/timeouts, temporary directory, S3 client/bucket и archive limits. Readiness проверяет HTTP runtime, PostgreSQL и `HeadBucket`; доступность db-service не блокирует startup, но влияет на конкретный upload как `503`.

Логи содержат correlation/request id, `bundleId`/`jobId` после их создания, project/design-system identifiers, итоговый acceptance result и стабильный error code. Содержимое archive и trusted credentials не логируются.

## Risks / Trade-offs

- [Risk] Любой project key может публиковать независимо от scopes. → Зафиксировать это как временную policy, гарантировать project binding через gateway и в следующем change ввести отдельный publish scope.
- [Risk] Direct service port позволяет подделать trusted headers при доступе извне. → Не публиковать port наружу в production, ограничить network policy и считать gateway единственным публичным ingress.
- [Risk] Gzip bomb или TAR path traversal исчерпают ресурсы/запишут данные вне storage. → Потоковые compressed/uncompressed limits, запрет link/device entries, нормализация paths и отсутствие распаковки archive entries на диск.
- [Risk] Ошибка или crash между S3 `PutObject` и DB commit оставит orphan object. → Read-back committed metadata перед compensation, `DeleteObject` только при подтвержденном rollback, уникальные keys и последующая reconciliation orphan objects.
- [Risk] Отсутствие idempotency создаст несколько jobs при retry после client timeout. → Хранить SHA-256 для диагностики; добавить `Idempotency-Key` отдельным change после согласования CLI retry semantics.
- [Risk] Job навсегда остается `accepted`, что выглядит как зависшая обработка. → Явно ограничить первый API upload endpoint и не обещать завершенную публикацию; worker/status lifecycle добавить следующим вертикальным срезом.
- [Risk] Изменение реального CLI manifest contract сломает прием. → Зафиксировать fixture на приложенном bundle, contract tests для schema `1.0` и отказ для неизвестной schema version.
- [Risk] Local MinIO и production provider могут различаться в деталях S3 API. → Использовать только переносимые `PutObject`, `DeleteObject` и `HeadBucket`, включить provider-specific endpoint/path-style через конфигурацию и добавить MinIO integration tests.

## Migration Plan

1. Добавить `documentation-service` в root Compose, подготовить PostgreSQL schema и production S3 bucket/credentials, не подключая публичный traffic.
2. В local stack поднять MinIO/init и проверить `HeadBucket`; в production проверить доступность заранее созданного bucket через service readiness.
3. Добавить новый `documentation_service_api` upstream и `/documentation/...` location в local/prod gateway configs, не меняя `/docs/...`.
4. Настроить `client_max_body_size` и proxy timeouts согласованно с service limits.
5. Выполнить smoke upload реального `docs-bundle.tar.gz` через gateway для owner/maintainer/editor и project key; проверить отказ viewer, чужого design system и небезопасного archive.
6. После стабилизации заменить CLI HTTP-заглушку отдельным change или явно включить эту работу в интеграционный этап реализации.

Rollback выполняется удалением нового gateway location/upstream и остановкой `documentation-service`. Сохраненные raw bundles и database rows не удаляются автоматически и могут быть использованы после повторного развертывания.

## Open Questions

- Должна ли реализация этого change также заменить `HttpDocsPublisher` CLI-заглушку, или producer integration оформляется отдельным change? Backend contract от этого решения не зависит.

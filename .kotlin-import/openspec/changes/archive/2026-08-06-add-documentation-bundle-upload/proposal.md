## Why

DS Builder CLI уже формирует самодостаточный пакет документации, но в backend отсутствует сервис, способный безопасно принять и сохранить этот пакет для последующей обработки. Первый этап сервиса документации должен зафиксировать реальный контракт публикации и создать надежную границу между загрузкой архива и будущим ingestion pipeline.

## What Changes

- Добавить новый production-микросервис `documentation-service` с модульной структурой `app` и `feature-ingestion`.
- Добавить project-scoped endpoint `POST /api/projects/{projectId}/documentation/bundles`, который принимает один `tar.gz` bundle как `multipart/form-data`.
- Сохранить существующий namespace `/api/projects/{projectId}/docs/...`, поскольку он маршрутизируется в другой сервис.
- Выполнять синхронную приемочную валидацию transport, USTAR/gzip-архива и `manifest.json` версии `1.0`, не запуская глубокую обработку документации.
- Проверять принадлежность `manifest.designSystem.id` проекту через существующий db-service endpoint `GET /api/ds/design-systems/{designSystemId}` с trusted project context.
- Разрешить публикацию пользователям с project role `owner`, `maintainer` или `editor`, а также любому валидному project-bound access key; отдельный publish scope в этой версии не вводится.
- Сохранять исходный архив как immutable raw bundle, создавать связанную ingestion job со статусом `accepted` и возвращать `202 Accepted` с `bundleId`, `jobId` и статусом.
- Добавить PostgreSQL persistence и S3-compatible object storage через application ports, конфигурацию лимитов загрузки, Dockerfile и healthcheck.
- Подключить documentation service и его инфраструктуру в корневые `docker-compose.local.yml` и `docker-compose.prod.yml`; local stack должен поднимать MinIO и создавать bucket, production stack должен подключаться к внешнему S3-compatible storage через env-конфигурацию.
- Не включать в change worker, глубокую валидацию `docs.json` и content, переходы job после `accepted`, read API документации, поиск и индексацию.

## Capabilities

### New Capabilities

- `documentation-bundle-ingestion`: Project-scoped прием, авторизация, приемочная валидация, ownership-проверка, хранение raw bundle и создание ingestion job со статусом `accepted`.

### Modified Capabilities

Нет.

## Impact

- Новый included build `documentation-service` и его модули `app` и `feature-ingestion`.
- Новый публичный REST API `POST /api/projects/{projectId}/documentation/bundles` и внутренний route `POST /documentation/bundles`.
- Изменения `identity-gateway/gateway` для отдельного `documentation_service_api` upstream и нового project-scoped route без изменения существующего `/docs/...`.
- Server-to-server интеграция с db-service для проверки связи project/design system.
- PostgreSQL-схема для metadata bundle и ingestion jobs; S3-compatible storage для неизменяемых `tar.gz` архивов.
- Новые application/env параметры для database, storage, db-service, HTTP/archive limits, runtime port и healthcheck.
- Корневой `settings.gradle.kts`, `docker-compose.local.yml`, `docker-compose.prod.yml` и build/verification pipeline.

## Why

Documentation service уже безопасно принимает и сохраняет bundle, но ingestion job останавливается в `accepted`, поэтому загруженная документация не превращается в доступную людям и агентам публикацию. Нужен полный асинхронный pipeline, который валидирует и нормализует bundle, строит `CodeBinding` и поисковые данные, атомарно публикует результат и предоставляет private read/search API.

## What Changes

- Расширить ingestion job состояниями глубокой валидации, нормализации, chunking, индексации, публикации и отказа, добавить PostgreSQL-backed worker с lease, heartbeat и безопасным retry временных инфраструктурных ошибок.
- Глубоко валидировать `docs.json`, markdown, локальные ссылки, assets и опциональные `components-info`/`theme-info`; сохранять единые структурированные diagnostics в job.
- Нормализовать bundle в candidate `DocumentationPublication`: дерево навигации, страницы, content, assets и metadata структурированных артефактов с immutable файлами публикации в S3-compatible storage.
- Доработать `dsbuilder docs generate`: обнаруживать канонические `.sdds/temp/docs/meta/components-info.json` и `theme-info.json` и указывать в manifest версионированный `format` по canonical platform и artifact type. Платформенные генераторы отвечают за канонические имена файлов.
- Поддержать canonical platforms `compose`, `android-view`, `swiftui`, `uikit`, `react` и `design`; в этом change реализовать info adapters для Compose, Android View, SwiftUI и UIKit, используя общую theme schema для SwiftUI/UIKit.
- Строить одну `component-style` binding на компонент с вложенными variations и одну `token` binding на token; строить `StructuredLookupTerm` для subjects, имён, параметров и точных platform references.
- Разбирать markdown через AST, связывать локальные assets, строить `KnowledgeChunk`, PostgreSQL FTS и trigram/точные индексы без embeddings и vector search.
- Атомарно переключать active publication по ключу `projectId + designSystemId + version + platform`; не изменять active publication при любой ошибке candidate pipeline.
- Добавить project-scoped private REST API статуса job, чтения активной публикации, navigation/pages/assets, точного и списочного чтения `CodeBinding`, полнотекстового/структурированного поиска и получения chunk по `kbUrl`.
- Не добавлять public/anonymous routes, embeddings, `pgvector`, semantic search, RRF, LLM reranking, `POST /documentation/context`, отдельный broker или UI.

## Capabilities

### New Capabilities

- `documentation-info-artifact-packaging`: Канонические имена, platforms и versioned formats опциональных `components-info`/`theme-info` в bundle, создаваемом CLI.
- `documentation-processing-pipeline`: Асинхронная глубокая валидация, нормализация, chunking, FTS-индексация и атомарная публикация documentation bundle.
- `documentation-code-bindings`: Platform adapters, canonical `CodeBinding` и `StructuredLookupTerm` для компонентов, variations и tokens.
- `documentation-publication-reading`: Project-scoped private API для job status, active publication, navigation, pages, assets и `CodeBinding`.
- `documentation-search`: Private поиск по markdown chunks и structured lookup с получением полного knowledge resource по `kbUrl`.

### Modified Capabilities

- `documentation-bundle-ingestion`: Созданная при upload job становится входом фонового pipeline и после `accepted` может переходить в дальнейшие ingestion states.

## Impact

- `documentation-service/feature-ingestion`: расширение job domain/application contracts, worker, scheduler/lease persistence, deep validation, diagnostics и orchestration pipeline.
- Новые feature-модули или внутренние пакеты documentation service для normalized publication, structured artifacts/`CodeBinding`, markdown chunking/indexing и private read/search presentation; общая инфраструктура выносится в `core` только при реальном совместном использовании несколькими `feature-*`.
- PostgreSQL: новые migrations для jobs/leases/diagnostics, publications/active pointer, navigation/pages/content/assets, structured artifacts, code bindings, lookup terms, chunks, FTS и `pg_trgm` indexes.
- S3-compatible storage: immutable publication prefixes для content, assets и source info/API artifacts при сохранении исходного raw archive.
- `dsbuilder-frontend/cli`: manifest platform/format mapping и contract tests канонических info-artifacts без platform-specific JSON parsing.
- `identity-gateway/gateway`: только project-scoped private read/search routes и trusted context; public namespace не добавляется.
- Новые markdown parser и PostgreSQL extension/configuration requirements; Compose/Android View/SwiftUI/UIKit JSON fixtures становятся contract-test данными без реальных credentials или приватных URL.

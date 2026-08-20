## 1. Контракты и структура documentation service

- [x] 1.1 Проверить `build-system` conventions и текущие модули `documentation-service`, затем определить feature/core boundaries для processing, publication и search без инфраструктурных типов в domain/application.
- [x] 1.2 Добавить необходимые зависимости markdown AST parser, PostgreSQL FTS/`pg_trgm` integration и test fixtures через общий version catalog и существующие Gradle conventions.
- [x] 1.3 Добавить application/env configuration worker enablement, polling, lease/heartbeat, retry attempts, temporary extraction, deep-validation/chunk limits и pagination/search limits с безопасными defaults.

## 2. CLI contract канонических info-artifacts

- [x] 2.1 Зафиксировать domain mapping canonical platforms `compose`, `android-view`, `swiftui`, `uikit`, `react`, `design` и versioned component/theme formats.
- [x] 2.2 Доработать `DocsGenerateUseCase`, чтобы канонические `meta/components-info.json` и `meta/theme-info.json` получали обязательный format по platform/type без поиска исторических имён или разбора platform JSON.
- [x] 2.3 Завершать generation ошибкой для неизвестной platform и info-artifact без известного format, сохраняя markdown-only bundle для platform без info-artifacts.
- [x] 2.4 Добавить CLI unit/contract tests для Compose, Android View, SwiftUI/UIKit общей iOS theme schema, markdown-only React/design и ошибочных combinations.

## 3. Domain и application модель pipeline

- [x] 3.1 Расширить `IngestionStatus`, `IngestionJob`, progress, attempt/lease timestamps и terminal failure model с русским KDoc публичных API.
- [x] 3.2 Добавить domain-модели `DocumentationPublication`, active key/pointer, navigation/page/content/asset, `StructuredArtifact`, `CodeBinding`, `StructuredLookupTerm`, `KnowledgeChunk` и единый `ProcessingDiagnostic`.
- [x] 3.3 Добавить application ports для job claiming/heartbeat/state transitions, raw/publication storage, temporary extraction, validation, normalization, adapter registry, chunking, indexing и atomic publication.
- [x] 3.4 Реализовать orchestration use case стадий `validating -> normalizing -> chunking -> indexing -> publishing` с lease-fenced indexing/publishing и классификацией retryable/non-retryable failures.
- [x] 3.5 Добавить unit-тесты orchestration для success, content failure, transient retry, attempts exhausted, lost lease и неизменности active pointer при отказе.

## 4. PostgreSQL migrations и job scheduler

- [x] 4.1 Добавить backward-compatible migration полей job: status/current step, publication ID, attempt, worker ID, lease, timestamps и progress.
- [x] 4.2 Добавить таблицы diagnostics, publications/active pointers, navigation/pages/content/assets/relationships, structured artifacts/bindings/lookup terms и knowledge chunks.
- [x] 4.3 Подключить `pg_trgm`, FTS columns/indexes, uniqueness constraints candidate entities и active key `(project_id, design_system_id, version, platform)`.
- [x] 4.4 Реализовать Exposed repositories и PostgreSQL claim через короткую transaction с `FOR UPDATE SKIP LOCKED`, conditional heartbeat/state writes и deterministic upserts.
- [x] 4.5 Реализовать atomic publish transaction: candidate `published`, previous `superseded`, active pointer switch и job `published` только при действующей lease.
- [x] 4.6 Добавить PostgreSQL integration tests конкурирующих claim, lease expiry, retry upserts, diagnostics, FTS/trigram indexes и success/failure active pointer.

## 5. Raw extraction и publication storage

- [x] 5.1 Реализовать streaming download raw bundle с проверкой persisted SHA-256 и безопасной temporary directory lifecycle.
- [x] 5.2 Реализовать extraction regular files с повторным path normalization, decompression/entry/path limits и отказом от links/special entries.
- [x] 5.3 Реализовать immutable S3 publication layout `publications/{publicationId}/...` для content, assets и source info/API artifacts с checksum/media metadata.
- [x] 5.4 Обеспечить cleanup temporary files на success/failure/cancellation и безопасное сохранение orphan candidate objects для последующей reconciliation без удаления active data.
- [x] 5.5 Добавить tests checksum mismatch, unsafe archive, limits, cleanup, immutable publication keys и повторного attempt.

## 6. Deep validation и нормализация документации

- [x] 6.1 Добавить explicit DTO/parser `dsb-resolved-docs-v1` и limits для navigation nodes/depth, page/content counts, string/path/file sizes.
- [x] 6.2 Реализовать deep validation group/page invariants, unique page paths, content format, safe/existing content refs, UTF-8 и canonical subject grammar.
- [x] 6.3 Подключить markdown AST parser и валидировать local image/link paths; отсутствующий/unsafe asset сделать error, unused asset и page без subjects — warning, external URLs не запрашивать.
- [x] 6.4 Нормализовать ordered navigation, pages, ordered Core/User content, assets и relationships с deterministic IDs.
- [x] 6.5 Добавить unit/golden tests invalid docs schema, navigation conflicts, subjects, missing refs/assets, external URL, unused asset warning и ordered multi-source page.

## 7. Structured artifact adapters и CodeBinding

- [x] 7.1 Реализовать registry выбора adapter по `(platform, artifactType, format)` и blocking diagnostics `MISSING_ARTIFACT_FORMAT`, `UNSUPPORTED_ARTIFACT_FORMAT`, `INVALID_STRUCTURED_ARTIFACT`.
- [x] 7.2 Добавить explicit input DTO и component/theme adapters Compose v1 с contract fixtures реальных shapes.
- [x] 7.3 Добавить explicit input DTO и component/theme adapters Android View v1 с resource/overlay/theme references.
- [x] 7.4 Добавить SwiftUI и UIKit component adapters и общий `sdds-ios-theme-info-v1` adapter с сохранением исходной platform publication.
- [x] 7.5 Реализовать mapping: одна `component-style` binding на `components.<key>` с вложенными variations и одна `token` binding на `tokens.<name>`.
- [x] 7.6 Реализовать deterministic lookup terms для subjects, names, keys, classes, params, variation/token/theme/resource references с сохранением технических символов.
- [x] 7.7 Сохранить raw structured artifact в publication storage, metadata/checksum в PostgreSQL и queryable binding columns/platform payload без обязательного дублирования полной parsed model.
- [x] 7.8 Добавить contract/golden tests всех adapters, optional absence, malformed element blocking без partial bindings, deterministic IDs и lookup terms.

## 8. Markdown chunking и индексация

- [x] 8.1 Реализовать AST chunking: H1 context, H2 boundary, H3/whole-block split oversized sections, UTF-8 `targetBytes`/`maxBytes` и запрет разрыва fenced code/table/list item.
- [x] 8.2 Сохранять ordered chunk metadata, heading path, source page/content/path, markdown, plain search text, subjects, approximate UTF-8 byte size и deterministic `kbUrl`.
- [x] 8.3 Реализовать FTS `simple` weighted projection для title/headings/subjects/body/code и trigram projections технических полей.
- [x] 8.4 Добавить golden tests heading layouts, page без H2, multi-content page, oversized atomic block warning, code/table preservation, deterministic retry и mixed Russian/English identifiers.

## 9. Private job и publication read API

- [x] 9.1 Добавить explicit DTO и internal route `GET /documentation/ingestion-jobs/{jobId}` со status/progress/attempt/timestamps/diagnostics и project ownership check.
- [x] 9.2 Добавить active publication endpoint по design system/version/platform, возвращающий только published active pointer.
- [x] 9.3 Добавить navigation и page endpoints с ordered content blocks, subjects и связанными asset metadata.
- [x] 9.4 Добавить publication-scoped asset endpoint с project authorization, safe media metadata и streaming/download behavior.
- [x] 9.5 Добавить exact `CodeBinding` endpoint и cursor-paginated listing с filters `subject`, `kind`, `name`, default limit `20` и max `100`.
- [x] 9.6 Добавить Ktor route tests happy paths, candidate invisibility, pagination/filters и cross-project `404` для jobs/publications/assets/bindings.

## 10. Private search и knowledge fetch API

- [x] 10.1 Реализовать application search use case по active publication и optional subjects, объединяющий structured exact/prefix matches и markdown FTS.
- [x] 10.2 Реализовать deterministic ranking: exact reference, exact subject/name, normalized/prefix technical match, затем FTS, без embeddings/LLM.
- [x] 10.3 Добавить explicit discriminated search DTO `code-binding`/`markdown`, snippets, pagination/limits и validation обязательных query/designSystem/version/platform.
- [x] 10.4 Добавить `GET /documentation/kb/fetch?url={kbUrl}` с parsing deterministic URL, project authorization и full chunk/source/publication metadata.
- [x] 10.5 Добавить integration/route tests structured-over-FTS ranking, subjects filter, mixed content search, missing active publication, stable `kbUrl` и cross-project fetch denial.

## 11. Gateway и runtime integration

- [x] 11.1 Добавить project-scoped private read/search/fetch locations под `/api/projects/{projectId}/documentation/...` с existing `auth_request`, trusted header replacement и корректным rewrite без public namespace.
- [x] 11.2 Настроить worker, limits, PostgreSQL extensions и S3 publication prefix environment/application config в local/production Compose без секретов.
- [x] 11.3 Обновить health/readiness так, чтобы API readiness проверяла PostgreSQL/S3, а worker health отражала возможность claim/heartbeat без блокировки upload API.
- [x] 11.4 Добавить gateway route regression tests: private documentation endpoints защищены, `/api/projects/{projectId}/docs/...` остаётся независимым, anonymous/public documentation route отсутствует.

## 12. End-to-end verification

- [x] 12.1 Подготовить малые sanitized contract fixtures Compose, Android View, SwiftUI и UIKit component/theme schemas без приватных данных и проверить их schema/adapters.
- [x] 12.5 Выполнить `documentation-service` tests, `detekt`, `spotlessCheck` и `build`; при formatting-only ошибках применить `spotlessApply`, проверить diff и повторить проверки.
- [x] 12.6 Выполнить `dsbuilder-frontend` CLI tests/build и `identity-gateway` tests, `detekt`, `spotlessCheck`, `build` после CLI/gateway изменений.
- [x] 12.7 Выполнить корневой `./gradlew build` для проверки composite build и убедиться, что Dockerfile/`docker-compose.local.yml`/`docker-compose.prod.yml`, env configuration и healthchecks остаются production-ready.

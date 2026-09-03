## Context

Текущий `documentation-service` принимает project-scoped `tar.gz`, выполняет ограниченную приемочную проверку, сохраняет raw archive в S3-compatible storage и атомарно создаёт `documentation_bundles` и `ingestion_jobs` со статусом `accepted`. Worker, последующие состояния job, нормализованная публикация и read/search API отсутствуют.

DS Builder CLI уже собирает `.sdds/temp/docs` в bundle и обнаруживает канонические `meta/components-info.json` и `meta/theme-info.json`, но не указывает их `format`. Реальные platform artifacts имеют разные JSON-схемы, хотя выражают общие сущности компонентов, variations и tokens. Compose и Android View предоставляют отдельные component/theme artifacts; SwiftUI и UIKit используют одинаковую theme schema, но разные component formats.

Pipeline должен безопасно обрабатывать недоверенный archive асинхронно, оставаться идемпотентным при падении worker, не нарушать активную публикацию при частичном отказе и обслуживать только private project-scoped clients. Архитектурные границы сохраняются как `presentation -> application -> domain`, infrastructure adapters находятся в `data`, wiring — в `di`.

## Goals / Non-Goals

**Goals:**

- Довести job от `accepted` до `published` или диагностируемого `failed` через PostgreSQL-backed worker.
- Построить нормализованные publication, navigation, pages, content и assets из самодостаточного bundle.
- Поддержать опциональные info-artifacts: если artifact присутствует, строго разобрать его поддерживаемым adapter и полностью построить `CodeBinding`/`StructuredLookupTerm`.
- Разбить markdown по AST на стабильные chunks, построить PostgreSQL FTS и exact/trigram structured indexes.
- Атомарно переключать active publication по `projectId + designSystemId + version + platform`.
- Предоставить private project-scoped job/read/search/fetch API с явными DTO и одинаковой моделью доступа для pages, assets, chunks и bindings.
- Поддержать безопасный retry worker, воспроизводимость данных и диагностику bundle-relative paths.

**Non-Goals:**

- Embeddings, `pgvector`, semantic search, RRF и LLM reranking.
- Public/anonymous routes, `POST /documentation/context`, HTML rendering и UI.
- Отдельный message broker или отдельный deployable worker в первой версии.
- Структурированный разбор API documentation; API artifacts индексируются только если generator заранее представил их как markdown content.
- React/design info adapters до появления зафиксированных schemas/fixtures.
- Автоматическое угадывание исторических имён info-файлов и platform-specific JSON parsing внутри CLI.
- Retention policy опубликованных версий и автоматический rollback на старую publication через публичный API.

## Decisions

### 1. Pipeline остаётся в `documentation-service`, но worker является отдельным runtime-компонентом

В included build добавляются feature-границы для processing, publication и search либо эквивалентные внутренние пакеты, если общий код пока недостаточен для отдельных Gradle modules. Domain/application contracts не зависят от Ktor, Exposed, S3 SDK или markdown parser. `app` запускает REST API и background worker независимо; worker можно отключить config-флагом и позднее вынести в отдельный process без изменения domain/API.

Альтернатива — сразу создать отдельный service и broker — отклонена из-за лишней эксплуатационной сложности и необходимости распределённой транзакции вокруг active pointer.

### 2. PostgreSQL queue использует короткий claim и lease, а не долгую row lock

Worker выбирает eligible job через `FOR UPDATE SKIP LOCKED`, в короткой транзакции назначает `workerId`, `leaseUntil`, увеличивает `attempt` и переводит job на текущий step. Во время обработки heartbeat продлевает lease условным update по `jobId + workerId`. По истечении lease job может забрать другой worker.

Defaults конфигурируемы: lease `60s`, heartbeat `20s`, polling `1s`, максимум `3` attempts. Retry выполняется только для transient storage/database failures; schema/content/adapter errors немедленно завершают job как `failed`. Индексирование в одной transaction блокирует job и проверяет `jobId + workerId + attempt + leaseUntil`; изменять дочерние данные разрешено только для publication в статусе `candidate`. Финальная публикация также проверяет ownership действующей lease.

Альтернатива — удерживать PostgreSQL transaction/lock на протяжении pipeline — отклонена из-за длительных блокировок и потери соединения при обработке больших bundle.

### 3. Candidate publication создаётся один раз на job и имеет детерминированные дочерние ID

Одна job соответствует одному `publicationId`, сохраняемому до тяжёлой обработки. Повторный attempt очищает или upsert-ит только candidate data этой publication. ID строятся детерминированно из `publicationId` и canonical keys: page path, asset archive path, chunk source/ordinal, binding kind/subject. Это предотвращает дубли при retry и упрощает диагностику.

Активный указатель хранится отдельно с уникальным ключом
`(projectId, designSystemId, designSystemVersion, platform)`. Candidate data не участвуют в private read/search API до финальной транзакции. Транзакция помечает candidate `published`, предыдущую publication `superseded`, переключает pointer и переводит job в `published`. При ошибке pointer не меняется.

### 4. Raw archive распаковывается во временную директорию с повторным применением safety limits

Worker потоково скачивает raw object, проверяет сохранённый SHA-256 и извлекает regular files в isolated configured temp root. Применяются acceptance path normalization и limits для total size, entry size/count/path length; links и special entries запрещены. Temporary tree удаляется при success, failure и cancellation.

Альтернатива — многократно сканировать `tar.gz` или держать bundle в памяти — отклонена из-за отсутствия random access и непредсказуемого memory usage.

### 5. Нормализованные файлы копируются в immutable publication prefix

Raw archive остаётся по raw key. Content, assets и source info/API files копируются в `publications/{publicationId}/...` с checksum, size и media type в PostgreSQL. Будущие read API не распаковывают raw archive. S3 objects candidate publication immutable; неуспешные candidate objects считаются orphan и удаляются отдельной reconciliation/retention операцией, а не опасным псевдотранзакционным rollback.

### 6. Deep validation отделяет ошибки целостности от warnings

Validator проверяет `docs.json` формата `dsb-resolved-docs-v1`, тип/глубину/лимиты navigation, уникальность page path, безопасные и существующие `contentRefs`, UTF-8 markdown, canonical subjects, local markdown links/assets и поддерживаемые info formats. External URLs не запрашиваются. Неиспользуемый asset и страница без subjects создают warning; отсутствующий/unsafe local asset, неизвестный info format или ошибка adapter создают error.

Subjects формируются как `components.<key>` и `tokens.<name>`. Входные subjects не могут быть пустыми, содержать whitespace/control characters или пустые dot-segments; case сохраняется. Один error блокирует publication. Diagnostics хранят `level`, стабильный `code`, безопасное `message`, bundle-relative `path`, `artifactType`, `subject` и JSON `details`.

### 7. CLI нормализует contract, а generators — имена файлов

Платформенные generators создают `.sdds/temp/docs/meta/components-info.json` и/или `theme-info.json`. CLI не принимает отдельные source paths и не ищет исторические имена. При обнаружении canonical файла CLI добавляет artifact и обязательный format по `(platform, artifactType)`.

Canonical platforms: `compose`, `android-view`, `swiftui`, `uikit`, `react`, `design`. Реализуемые formats:

| Platform | Components format | Theme format |
| --- | --- | --- |
| `compose` | `sdds-compose-components-info-v1` | `sdds-compose-theme-info-v1` |
| `android-view` | `sdds-view-components-info-v1` | `sdds-view-theme-info-v1` |
| `swiftui` | `sdds-swiftui-components-info-v1` | `sdds-ios-theme-info-v1` |
| `uikit` | `sdds-uikit-components-info-v1` | `sdds-ios-theme-info-v1` |

`react` и `design` допустимы для markdown-only bundle; присутствующий info artifact без adapter блокирует processing. Format version принадлежит artifact schema, поэтому SwiftUI/UIKit совместно используют одинаковую iOS theme schema.

### 8. Adapter registry строит общую проекцию, не унифицируя platform JSON

Registry выбирает adapter по `(platform, artifactType, format)`. Adapter декодирует explicit input DTO, валидирует platform model и возвращает `CodeBinding`/lookup terms. Raw JSON сохраняется в S3, metadata и checksum — в `StructuredArtifact`; полная многомегабайтная parsed model не дублируется в PostgreSQL, если canonical bindings полностью отражают необходимые query data.

Одна `component-style` binding создаётся на component с subject `components.<key>`; props, `styleApi` и variations находятся в JSON payload. Variation не получает отдельный binding ID, но все имена, parameter pairs и references становятся lookup terms. Одна `token` binding создаётся на token с subject `tokens.<name>` и platform payload с type/displayName/description/value/reference/themeReference.

Альтернатива — одна binding на variation — отклонена из-за тысяч записей, дублирования component API и отсутствия самостоятельного product identity variation.

### 9. Markdown chunking основан на AST и сохраняет исходную адресацию

Каждый ordered `contentRef` страницы парсится отдельно. H1 задаёт page context, H2 создаёт базовые chunks, отсутствие H2 даёт один chunk, oversized H2 делится по H3 и далее по целым AST blocks. Обычный paragraph/text block, который сам превышает `maxBytes`, дополнительно делится по безопасным UTF-8 boundaries с предпочтением word/sentence boundary. Fenced code, table и list item не режутся. Chunk хранит page/content IDs, ordinal, heading path, source path, markdown, plain search text, subjects и `kbUrl`. `targetBytes`/`maxBytes` измеряются по UTF-8 representation и конфигурируются отдельно; oversized atomic block сохраняется целиком с warning.

Локальные markdown image/link nodes резолвятся относительно source content path, связываются с normalized asset и проверяются. External `http`/`https` URLs остаются как есть и не проверяются по сети.

### 10. Первый search использует PostgreSQL FTS + `pg_trgm` + structured lookup

Для смешанного русского/английского технического контента применяется `simple` text search config. Search vector повышает title, heading path и subjects относительно body; code blocks включаются. `pg_trgm` и normalized structured terms сохраняют `.`, `_`, `-`, `@`, `?` и обеспечивают технический prefix/fuzzy lookup.

Результаты ранжируются группами: exact structured reference, exact subject/name, normalized/prefix technical match, затем markdown FTS. Vector channel отсутствует, поэтому RRF не применяется. API возвращает discriminated `code-binding` и `markdown` DTO; markdown result содержит `kbUrl`, а `/kb/fetch` возвращает полный опубликованный chunk.

### 11. Все API остаются project-scoped private

Gateway добавляет/расширяет только `/api/projects/{projectId}/documentation/...`, выполняет existing project auth и заменяет trusted headers. Documentation service проверяет, что requested job/publication принадлежит trusted project. `kbUrl` и `assetId` не являются capability tokens и не обходят authorization. Anonymous/public namespace не создаётся.

Listing endpoints используют cursor pagination с configurable default `20` и max `100`. Search требует query, design system, version и platform; optional subjects фильтруют оба result types.

## Risks / Trade-offs

- [Risk] Падение worker между S3 writes и database commit оставит orphan objects. → Использовать immutable publication prefix, не публиковать candidate до DB transaction и добавить reconciliation по непубликованным publication.
- [Risk] Истёкшую lease может одновременно обрабатывать старый и новый worker. → Все state writes и финальный publish выполнять conditional update по `workerId`; IDs/upserts сделать идемпотентными.
- [Risk] Строгий unknown-format policy заблокирует bundle после обновления generator. → Версионировать formats, выпускать adapter до включения нового generator и проверять общими contract fixtures.
- [Risk] `simple` FTS хуже учитывает морфологию русского текста. → Сохранить `SearchIndex` port и позже добавить языковые projections или OpenSearch без изменения domain/API.
- [Risk] Вложенные variations создают крупный `CodeBinding` payload. → Ограничить artifact/component size, использовать listing summary DTO и возвращать полный payload только exact endpoint.
- [Risk] Markdown AST libraries трактуют permissive syntax по-разному. → Зафиксировать parser/version, golden fixtures и считать ошибками только нарушения целостности, а не style.
- [Risk] Change затрагивает worker, persistence, CLI, gateway и API и получается крупным. → Реализовывать вертикальными группами tasks с contract/integration verification после каждой группы.

## Migration Plan

1. Добавить backward-compatible database migrations и `pg_trgm`; существующие `accepted` jobs сохраняются.
2. Выпустить CLI format mapping и generator conventions до обязательной обработки новых info artifacts. Старые markdown-only bundle остаются допустимыми; старые info artifacts без format завершатся диагностируемым `failed` после запуска worker.
3. Развернуть service с worker disabled, применить migrations и проверить readiness PostgreSQL/S3.
4. Включить один worker instance, обработать существующие eligible `accepted` jobs и проверить candidate/active data.
5. Добавить private gateway read/search routes и затем масштабировать worker instances.
6. При rollback отключить worker и новые routes; upload продолжает создавать `accepted` jobs. Уже опубликованные данные и старый active pointer сохраняются, migrations не удаляются.

## Open Questions

Нет блокирующих продуктовых вопросов. Конкретные числовые limits, polling intervals и pagination defaults остаются environment configuration с безопасными значениями из этого design и могут уточняться performance-тестами без изменения публичного контракта.

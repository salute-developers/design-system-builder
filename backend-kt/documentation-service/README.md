# Documentation Service

## Private lexical search

`GET /documentation/search` ищет только внутри active publication trusted project. Обязательные параметры:
`designSystemId`, `version`, `platform`, `query`; `subject` можно повторять, значения объединяются как OR. `cursor`
является offset в bounded candidate window, `limit` по умолчанию равен 20 и ограничен runtime configuration.

`query` трактуется как literal text. Сервис не интерпретирует кавычки, `-` или `OR` как advanced operators. Canonical
normalization сохраняет `.`, `-`, `_`, `:`, `@`, `?` в exact representation и дополнительно разбивает CamelCase,
qualified, kebab-case и snake_case identifiers. Пустой после normalization запрос возвращает `400`.

Structured results содержат прежние поля и optional `matchType`/`termType`; markdown results — прежние поля и optional
`matchType`/`matchedFields`. `rank` сохранён для совместимости markdown DTO, но не является стабильной или сопоставимой
между каналами оценкой. Snippet — bounded plain text вокруг lexical match, не доверенный HTML.

Search является lexical-only: exact/prefix/bounded trigram structured lookup плюс technical, Russian и English PostgreSQL
FTS. Semantic и cross-language equivalence, автоматический перевод, embeddings и LLM reranking не гарантируются.
Profile `lexical-v2` индексирует raw и CamelCase-tokenized technical representations. Exact page title и terminal title
token (например, `Button` в `BasicButton`) ранжируются выше generic title/body frequency и отражаются в `matchType` как
`title-exact` или `title-token-suffix`.

## Ranking profile and operations

Default profile `lexical-v2` задаётся `DOCUMENTATION_SEARCH_*`: per-channel/total candidate limits, fuzzy minimum length
and threshold, RRF constant/weights и snippet bounds. Значения не содержат secrets. Standard telemetry включает только
latency, candidate/result counts, zero-result и низкокардинальные match channels; raw query, project и publication labels
не записываются.

До первого production deployment схема поставляется одной Flyway baseline migration `V1__documentation_schema.sql`.
Она сразу создаёт финальные generated technical/Russian/English projections, composite B-tree `text_pattern_ops` indexes
для anchored literal prefix и GIN/trigram indexes для fuzzy lookup без legacy search columns. После первого production
deployment baseline не переписывается: все последующие изменения добавляются новыми versioned migrations. Для больших
production tables будущие GIN indexes следует создавать `CONCURRENTLY` отдельной
операционной процедурой, если обычная transactional migration создаёт неприемлемую блокировку.

Representative plan verification выполняется на production-like PostgreSQL через `EXPLAIN (ANALYZE, BUFFERS)` для
exact, prefix, trigram и каждого FTS channel. Проверяются publication/subject filters до `LIMIT`, использование B-tree
prefix и GIN/trigram indexes и отсутствие snippet/ranking work вне hard candidate window.

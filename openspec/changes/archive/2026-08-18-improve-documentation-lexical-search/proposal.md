## Why

Текущий поиск документации надёжно находит точные `CodeBinding` и полнотекстовые совпадения, но не использует уже созданные trigram-индексы, не учитывает русскую и английскую морфологию, возвращает начало chunk вместо релевантного фрагмента и всегда ставит слабые structured prefix matches выше сильных markdown matches. До появления доказанной потребности в embeddings необходимо повысить полноту, предсказуемость и объяснимость детерминированного lexical search средствами PostgreSQL.

## What Changes

- Ввести единую нормализацию поискового запроса и индексируемых технических терминов с сохранением значимых символов и дополнительным разбиением CamelCase, qualified, kebab-case и snake_case identifiers.
- Расширить structured search каналами exact, prefix и bounded trigram matching с явной силой совпадения и дедупликацией по `codeBindingId`.
- Разделить markdown search на technical `simple`, русскую и английскую FTS-проекции с индексированием title, headings, subjects, paths, code и body с различными весами.
- Заменить безусловный порядок `structured before markdown` на tiers для exact structured matches и детерминированное rank fusion для остальных lexical channels.
- Формировать безопасный plain-text snippet вокруг найденного совпадения и возвращать объяснимые `matchType`/matched-field metadata без стабильного публичного numeric score.
- Добавить versioned search eval fixtures, quality regressions, bounded candidate processing, query limits и операционные метрики без логирования raw query по умолчанию.
- Актуализировать ADR-0002: embeddings, vector search и LLM reranking не являются обязательной стадией публикации и остаются возможным будущим расширением после измеримого lexical-search baseline.
- Не добавлять embedding provider, `pgvector`, OpenSearch, автоматический перевод запросов, public/anonymous documentation routes или генерацию ответа.

## Capabilities

### New Capabilities

Отсутствуют.

### Modified Capabilities

- `documentation-search`: многоязычный и technical lexical retrieval, typo-tolerant structured lookup, детерминированное объединение каналов, релевантные snippets, объяснимые результаты и измеримое качество без embeddings/LLM.

## Impact

- `documentation-service/feature-search`: query normalization, search ports/models/use case, PostgreSQL queries, result DTO и tests.
- `documentation-service/feature-processing`: построение дополнительных детерминированных поисковых проекций и нормализованных lookup terms без изменения source bundle contract.
- `documentation-service/app`: единая pre-production PostgreSQL baseline schema с финальными FTS/trigram projections, search limits/weights configuration и runtime wiring.
- `openspec/architecture/ADR-0002-documentation.md`: уточнение lexical-first решения и переноса embeddings в future evolution.
- REST endpoint и обязательные request parameters сохраняются; response получает только backward-compatible metadata.
- Новые внешние сервисы, secrets и network dependencies не появляются.

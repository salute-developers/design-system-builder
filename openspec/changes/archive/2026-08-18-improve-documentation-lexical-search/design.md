## Context

`documentation-service` уже строит `StructuredLookupTerm` и `KnowledgeChunk`, хранит их в PostgreSQL и обслуживает private project-scoped `GET /documentation/search`. Structured channel выполняет exact/prefix matching, markdown channel использует один generated `tsvector` с конфигурацией `simple`, а application use case конкатенирует все structured results перед FTS results. Созданные `pg_trgm` индексы не участвуют в поиске, `source_path` индексирован, но не входит в query, snippet является первыми 300 символами `search_text`.

Документация смешивает русский и английский естественный язык с чувствительными к пунктуации identifiers (`color.text.primary`, `size-72`, qualified names). Решение должно оставаться детерминированным, project-scoped и восстанавливаемым из publication без внешних provider, network calls или новой поисковой инфраструктуры.

## Goals / Non-Goals

**Goals:**

- повысить recall для русских/английских словоформ, technical identifiers, prefix и ограниченных typo-сценариев;
- сохранить exact structured lookup как наиболее сильный и объяснимый источник;
- объединять несопоставимые PostgreSQL ranks без публикации нестабильного общего numeric score;
- возвращать match-centered plain-text snippets и явный тип совпадения;
- ограничить стоимость каждого channel и зафиксировать качество versioned eval-набором;
- сохранить активную publication, project authorization и существующий REST request contract.

**Non-Goals:**

- embeddings, `pgvector`, semantic/cross-language retrieval и LLM reranking;
- автоматический перевод, неуправляемая генерация synonyms или ответов;
- public/anonymous routes, изменение `kbUrl` или `CodeBinding` read API;
- OpenSearch/Elasticsearch, отдельный broker или новый runtime service;
- пользовательский advanced query language и совместимость с неявными `websearch_to_tsquery` operators.

## Decisions

### 1. Один domain/application query plan и PostgreSQL-specific execution в data

Application вводит нормализованный `LexicalSearchQuery`, типизированные channel hits, match strength и fusion policy. Нормализация и ranking не зависят от Exposed/PostgreSQL. Data adapter отвечает за `tsquery`, `ts_rank_cd`, `ts_headline`, trigram operators и SQL candidate limits. Presentation продолжает работать с explicit request/response DTO; DI/runtime передают limits и weights из application config.

Альтернатива — собрать всю логику одним SQL `UNION`. Она уменьшает число round trips, но связывает ranking policy с PostgreSQL expressions и усложняет unit-тестирование. Для первого объёма допускаются несколько bounded channel queries в одной read transaction; оптимизация в один statement возможна после профилирования без изменения port.

### 2. Literal query contract вместо неявного web-search синтаксиса

Raw query нормализуется Unicode-aware, пробелы схлопываются, а технически значимые `.`, `-`, `_`, `:`, `@`, `?` сохраняются в exact representation. Отдельная token representation разбивает CamelCase, qualified, kebab-case и snake_case identifiers. Default natural-language queries строятся через forgiving literal/plain parsing; `-`, кавычки и `OR` не объявляются operators публичного API.

Prefix lookup сравнивает exact и token representations буквально. Символы `%`, `_` и `\` экранируются, после чего к
параметру добавляется единственный служебный `%`; SQL явно задаёт `LIKE ... ESCAPE`. Normalized и tokenized branches
разделены через `UNION ALL` и используют composite B-tree `text_pattern_ops` indexes, а оконная функция удаляет дубли.

Альтернатива — сохранить `websearch_to_tsquery`. Она поддерживает phrase/negative syntax, но интерпретирует `-` как NOT и конфликтует с `size-72`; публичный endpoint не документирует advanced syntax. Phrase proximity остаётся внутренним ranking signal, а не пользовательским языком запросов.

### 3. Три markdown FTS-проекции

`knowledge_chunks` получает independently indexed projections:

```text
technical_search_vector = simple(title, headings, subjects, page/source path, code, body)
russian_search_vector   = russian(title, headings, body)
english_search_vector   = english(title, headings, body)
```

Title/headings/subjects получают вес `A`, path/code — `B`, body — `C`. Для natural-language channels применяется `ts_rank_cd` с document-length normalization; technical channel не выполняет stemming и сохраняет lexemes технического текста. Языки не определяются эвристикой: один запрос безопасно исполняется по всем трём bounded channels.

Альтернатива — один `simple` vector. Он сохраняет identifiers, но не связывает русские/английские словоформы. Определение единственного языка query отклонено из-за mixed-language запросов и identifiers.

### 4. Structured exact, prefix и bounded trigram channels

Lookup-term normalization переиспользует ту же canonical функцию, что и query. Structured adapter возвращает категории:

```text
EXACT_REFERENCE
EXACT_SUBJECT_OR_NAME
EXACT_OTHER_TERM
PREFIX
TRIGRAM
```

Trigram включается только после publication/subject filters, для запросов не короче configured minimum и с explicit threshold. Один `codeBindingId` сворачивается в один hit с самым сильным evidence внутри PostgreSQL до применения channel candidate limit; matched term и term category сохраняются.

Альтернатива — применять fuzzy matching ко всему markdown body. Она создаёт много шума и дорогих кандидатов; typo tolerance ограничивается structured terms и короткими metadata fields.

### 5. Exact tiers плюс weighted reciprocal-rank fusion

Exact reference и exact subject/name/other structured matches образуют приоритетные tiers. Prefix, trigram и три FTS channel объединяются weighted RRF, потому что `ts_rank_cd` и trigram similarity имеют разные шкалы. Итоговый tie-breaker использует стабильный `resultType + stableId`.

```text
Tier 0: exact reference
Tier 1: exact subject/name/other term
Tier 2: weighted RRF(technical FTS, russian FTS, english FTS, prefix, trigram)
```

Дубликаты markdown сворачиваются по `kbUrl`, structured — по `codeBindingId`. Offset cursor и общий bounded candidate window сохраняются; алгоритм обязан возвращать стабильный порядок для неизменной active publication и конфигурации.

Альтернатива — оставить все structured results перед FTS. Она предсказуема, но слабый общий prefix вытесняет точное совпадение в title/body. Прямое сложение scores отклонено из-за несовместимых шкал.

### 6. Plain-text snippet после отбора кандидатов

Для markdown top results data adapter формирует фрагмент вокруг FTS match через PostgreSQL headline/excerpt mechanism по очищенному `search_text`. Highlight markers не возвращаются как HTML; snippet ограничивается словами и UTF-8 bytes. Если канал не может выделить совпадение, используется bounded начало текста. Дорогая операция выполняется после ranking/limit, а не для полного candidate set.

### 7. Backward-compatible explainability metadata

Существующие поля REST response сохраняются. Добавляются nullable/optional `matchType`, `matchedFields` и structured `termType`; raw PostgreSQL rank сохраняется только на время совместимости и не становится общим contractual score. Raw query не пишется в logs/metrics по умолчанию. Метрики используют channel, match type, latency, candidate/result counts и zero-result outcome без high-cardinality project/publication labels.

### 8. Versioned lexical-search eval

В репозитории хранится sanitized golden corpus с exact, prefix, typo, punctuation, Russian morphology, English morphology, mixed identifier и negative cases. Exact cases проверяют Top 1, остальные — expected Top K; suite вычисляет как минимум Recall@5 и MRR и блокирует regressions относительно зафиксированного baseline. Cross-language conceptual equivalence не входит в target corpus без явно управляемого alias.

### 9. Evidence-backed title affinity correction

Проверка опубликованной документации показала, что body-frequency ставит `ButtonGroup` выше страницы `BasicButton` для
query `Button`, а raw technical projection не находит `AiInputStyle.mode` после query tokenization. Profile `lexical-v2`
индексирует одновременно raw и CamelCase-tokenized technical representations. Exact title и terminal title-token
совпадения образуют explainable markdown tier перед обычным RRF, при этом generic title-token и body matches остаются в
fusion. Repository использует фиксированный configured candidate window независимо от response `limit`, чтобы Top N был
стабилен между страницами разного размера.

## Risks / Trade-offs

- [Три FTS projection увеличат размер таблицы и GIN indexes] → измерить migration/index size на representative corpus и оставить поля производными/rebuildable.
- [Trigram может давать шум и дорогие запросы] → minimum query length, explicit threshold, publication-first filtering и hard candidate limit.
- [Russian/English stemming может ранжировать неожиданные формы] → сохранить parallel technical channel и покрыть known queries golden eval.
- [RRF weights могут переобучиться на малый corpus] → хранить weights в configuration, фиксировать default profile version и менять только вместе с eval evidence.
- [Offset pagination зависит от полного candidate window] → стабильные tie-breakers и bounded cursor; opaque/keyset cursor откладывается до подтверждённой потребности.
- [PostgreSQL headline может вернуть небезопасную разметку] → входом служит plain `search_text`, output не считается HTML и не содержит HTML highlight markers.
- [Без embeddings нет автоматического conceptual/cross-language matching] → явно оставить это non-goal, измерять zero-result queries и рассматривать curated aliases отдельным change.

## Migration Plan

1. До первого production deployment объединить дорелизную историю schema в одну `V1__documentation_schema.sql` с финальными таблицами, constraints, lexical projections и indexes.
2. Проверить baseline на чистой PostgreSQL database; локальные databases с прежней Flyway history пересоздать вместо поддержки несуществующего production upgrade path.
3. Развернуть search code и baseline вместе, сохранив endpoint и DTO fields, затем проверить representative eval, query plans и candidate limits.
4. После первого production deployment не изменять checksum V1: любые schema changes и rollback-compatible переходы выпускать только новыми versioned migrations.

## Open Questions

- Должны ли будущие production migrations создавать большие indexes обычным способом или отдельной операционной процедурой `CREATE INDEX CONCURRENTLY` вне Flyway transaction?
- Нужен ли `rank` в REST response для backward compatibility или его можно пометить deprecated в этом change?
- Какие начальные RRF weights и trigram thresholds принять после измерения baseline corpus?
- Где в дальнейшем хранить curated domain aliases, если telemetry подтвердит потребность в cross-language lexical expansion?

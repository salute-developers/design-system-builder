## 1. Baseline и search profile

- [x] 1.1 Зафиксировать sanitized eval corpus и текущие результаты exact, prefix, punctuation, Russian/English morphology, typo и negative queries до изменения алгоритма.
- [x] 1.2 Определить versioned default lexical ranking profile: candidate limits, fuzzy minimum length/threshold, RRF constant/weights, snippet limits и quality acceptance baseline.
- [x] 1.3 Добавить application/env configuration новых search limits и ranking profile с безопасными defaults без secrets и raw-query logging.

## 2. Canonical query и term normalization

- [x] 2.1 Добавить application/domain модели canonical exact/token query representations и stable match strength/category с русским KDoc.
- [x] 2.2 Реализовать единую Unicode-aware normalization для query и lookup terms с сохранением `.`, `-`, `_`, `:`, `@`, `?` и разбиением CamelCase, qualified, kebab-case и snake_case identifiers.
- [x] 2.3 Подключить normalization к построению `StructuredLookupTerm` и search query без изменения source bundle contract.
- [x] 2.4 Добавить unit/golden tests normalization для technical identifiers, whitespace, Unicode, punctuation, empty/oversized input и детерминированности retry.

## 3. PostgreSQL lexical projections

- [x] 3.1 Спроектировать backward-compatible migration technical `simple`, Russian и English FTS projections с weights для title/headings/subjects/path/code/body.
- [x] 3.2 Добавить GIN indexes FTS projections и подходящие trigram indexes для bounded structured/metadata lookup.
- [x] 3.3 Реализовать backfill/rebuild существующих `knowledge_chunks` и зафиксировать production-safe стратегию index build/rollback.
- [x] 3.4 Добавить migration/integration tests наличия projections, indexes, повторяемости migration и поиска по существующим publication rows.

## 4. Structured exact, prefix и trigram lookup

- [x] 4.1 Расширить search port/model категориями exact reference, exact subject/name, exact other term, prefix и trigram с evidence metadata.
- [x] 4.2 Реализовать PostgreSQL structured queries с publication/subject filters до candidate limit, minimum fuzzy length и configured trigram threshold.
- [x] 4.3 Дедуплицировать несколько lookup-term matches одного `codeBindingId`, сохраняя strongest evidence и deterministic tie-breaker.
- [x] 4.4 Добавить repository tests exact/prefix/trigram ranking, typo threshold, short-query fuzzy skip, filters-before-limit и bounded candidates.

## 5. Technical, Russian и English markdown FTS

- [x] 5.1 Заменить единственный `websearch_to_tsquery('simple', ...)` на literal technical/Russian/English channel queries без неявных advanced operators.
- [x] 5.2 Реализовать weighted `ts_rank_cd` и document-length normalization для title/headings/body, technical path/code/subjects и phrase/proximity signals.
- [x] 5.3 Обеспечить один markdown hit на `kbUrl` со списком сработавших channels/fields и strongest channel evidence.
- [x] 5.4 Добавить PostgreSQL tests русской/английской морфологии, mixed identifiers, hyphenated tokens, paths, code blocks, subject filters и stable ordering.

## 6. Fusion и pagination

- [x] 6.1 Реализовать exact tiers и versioned weighted RRF для prefix, trigram и трёх FTS channels в application use case.
- [x] 6.2 Добавить дедупликацию по `codeBindingId`/`kbUrl`, stable tie-breakers, общий bounded candidate window и сохранение cursor limits.
- [x] 6.3 Добавить unit tests exact dominance, strong FTS против weak prefix, multi-channel duplicates, deterministic ties, pagination и hard candidate bound.

## 7. Snippets и REST DTO

- [x] 7.1 Реализовать match-centered bounded snippet по очищенному `search_text` только для отобранных top markdown results с plain-text fallback.
- [x] 7.2 Расширить explicit response DTO backward-compatible полями `matchType`, `matchedFields` и structured `termType`, не делая numeric fusion/database score стабильным contract.
- [x] 7.3 Добавить repository/route tests совпадения в середине chunk, UTF-8 limits, markup-like content, backward-compatible JSON и explainable structured/markdown results.

## 8. Eval, performance и observability

- [x] 8.1 Реализовать automated lexical eval runner для Top 1, Top K, Recall@5 и MRR на versioned corpus.
- [x] 8.2 Добавить regression gates для exact, morphology, punctuation, typo, negative noise, cross-project/non-active isolation и deterministic order.
- [x] 8.3 Проверить representative PostgreSQL query plans, indexes, filters-before-limit и отсутствие unbounded snippet/ranking work.
- [x] 8.4 Добавить low-cardinality metrics latency/candidates/results/zero-result/match-channel без raw query и project/publication labels по умолчанию.

## 9. Архитектура, документация и verification

- [x] 9.1 Актуализировать ADR-0002: lexical search является обязательным baseline, embeddings/vector search и LLM reranking отложены до отдельного evidence-backed решения и не блокируют publication.
- [x] 9.2 Обновить service/API documentation для literal query semantics, match metadata, subject OR filters, pagination limits и отсутствия semantic/cross-language guarantees.
- [x] 9.3 Выполнить documentation-service unit/integration/route/eval tests, `detekt`, `spotlessCheck` и `build`; при formatting-only ошибках применить `spotlessApply`, проверить diff и повторить проверки.
- [x] 9.4 Выполнить корневой `./gradlew build` и проверить local/production configuration/migrations без добавления external services, secrets или embedding dependencies.

## 10. Evidence-backed ranking corrections

- [x] 10.1 Добавить symmetric technical query/index representations для CamelCase и punctuation identifiers в markdown.
- [x] 10.2 Добавить deterministic markdown title affinity tiers: exact title и terminal title token выше body-frequency matches.
- [x] 10.3 Сделать repository candidate window независимым от response `limit`, сохранив hard bounds и stable pagination.
- [x] 10.4 Добавить regression tests `Button -> BasicButtonUsage.md > ButtonGroup`, `AiInputStyle.mode` и стабильности Top N при разных page limits.
- [x] 10.5 Применить migration к опубликованной local publication и подтвердить исправление реальными API-запросами.

## 11. Pre-production database baseline

- [x] 11.1 Объединить дорелизные Flyway migrations V1–V5 в одну финальную production baseline schema без transitional rollback projections.
- [x] 11.2 Использовать финальные имена lexical projections/indexes и синхронизировать runtime repository с baseline schema.
- [x] 11.3 Обновить migration contract/integration tests и service documentation для single-baseline стратегии.
- [x] 11.4 Проверить baseline на чистой PostgreSQL database, выполнить quality gates и строгую OpenSpec validation.
- [x] 11.5 Пересоздать локальную documentation DB, поднять сервис и подтвердить повторную публикацию/поиск.

## 12. ADR MVP alignment

- [x] 12.1 Перевести ADR-0002 в accepted status и зафиксировать private lexical-only MVP без embeddings/vector/public visibility.
- [x] 12.2 Синхронизировать REST API, query parameters, response shapes и `dsb://` knowledge URL с реализованным контрактом.
- [x] 12.3 Зафиксировать полный MVP `CodeBinding` contract: kinds `component-style`/`token`, platforms `compose`/`android-view`/`swiftui`, без Web/UIKit adapters.
- [x] 12.4 Удалить противоречащие MVP diagrams, storage models, processing statuses и open questions; проверить ADR и OpenSpec validation.

## 13. Structured lexical correctness regressions

- [x] 13.1 Сделать prefix lookup literal для `_`, `%` и `\`, исключив SQL LIKE wildcard semantics.
- [x] 13.2 Дедуплицировать и ранжировать structured candidates по `codeBindingId` внутри PostgreSQL до `LIMIT`.
- [x] 13.3 Синхронизировать обязательные lookup terms/categories с ADR и фактическим source contract, включая kind и codeName.
- [x] 13.4 Добавить PostgreSQL и adapter regression tests для literal punctuation, logical candidate limit и каждого обязательного term type.
- [x] 13.5 Выполнить focused tests, formatting, detekt, build, `git diff --check` и strict OpenSpec validation.

## 14. Indexable literal prefix

- [x] 14.1 Заменить `starts_with` на escaped `LIKE ... ESCAPE` с literal обработкой `\`, `%`, `_`.
- [x] 14.2 Добавить production-like PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` regression для использования dedicated structured prefix indexes.
- [x] 14.3 Синхронизировать design/spec/ADR с индексируемой literal prefix реализацией.
- [x] 14.4 Выполнить PostgreSQL tests, formatting, detekt, build, `git diff --check` и strict OpenSpec validation.

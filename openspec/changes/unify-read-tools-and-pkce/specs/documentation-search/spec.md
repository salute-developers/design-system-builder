## MODIFIED Requirements

### Requirement: Private combined documentation search
Service SHALL предоставлять private project-scoped lexical search по выбранной опубликованной публикации только actor с permission `documentation:read`, объединяя normalized exact/prefix/trigram `StructuredLookupTerm` и technical/Russian/English PostgreSQL FTS `KnowledgeChunk` без semantic/vector search, embedding provider, LLM или network dependency.

#### Scenario: User actor имеет read grant
- **WHEN** trusted user actor имеет effective project role с grant `documentation:read`
- **THEN** service SHALL разрешить search внутри active publication trusted project

#### Scenario: Project key не имеет read scope
- **WHEN** trusted project key actor вызывает search без scope `documentation:read`
- **THEN** service MUST вернуть `403 Forbidden`
- **AND** MUST NOT выполнять search query

#### Scenario: Technical reference найден
- **WHEN** authorized query после canonical normalization точно совпадает с variation reference `Avatar.Xxl`
- **THEN** structured result SHALL находиться в exact-reference tier выше non-exact lexical results
- **AND** result SHALL содержать `codeBindingId`, subject, kind, name, matched term, term type и exact match type

#### Scenario: Markdown найден полнотекстово
- **WHEN** authorized query совпадает с technical, Russian или English FTS projection опубликованного chunk
- **THEN** result SHALL содержать `kbUrl`, title, match-centered plain-text snippet, page path, subjects и explainable match type

#### Scenario: Внешний inference отсутствует
- **WHEN** service выполняет indexing или authorized search
- **THEN** service MUST NOT вызывать embedding provider, LLM или другой network retrieval dependency

### Requirement: Ограничение поиска active publication и filters
Search MUST принимать `designSystemId`, `version`, canonical `platform`, query и optional subjects и MUST искать только внутри выбранной опубликованной публикации доверенного проекта.

#### Scenario: Subject filter указан
- **WHEN** client передаёт один или несколько subjects
- **THEN** structured и markdown channels SHALL вернуть только results, связанные с этими subjects

#### Scenario: Active publication отсутствует
- **WHEN** для запрошенного ключа нет active publication
- **THEN** search MUST вернуть `404 Not Found`


#### Scenario: Явная опубликованная публикация

- **WHEN** клиент передаёт publicationId опубликованной публикации выбранной дизайн-системы
- **THEN** сервис MUST искать только в ней, даже если она заменена новой активной публикацией
- **THEN** явные несовместимые version/platform MUST вернуть INVALID_QUERY

#### Scenario: Переиздание между страницами

- **WHEN** активная публикация изменилась после первой страницы
- **THEN** cursor MUST продолжать чтение исходной публикации с теми же фильтрами и ранжированием
- **THEN** несовместимое повторное использование cursor MUST вернуть INVALID_QUERY

### Requirement: Versioned lexical-search quality regression
Repository MUST содержать sanitized versioned eval corpus для exact, normalized, prefix, typo, punctuation, Russian morphology, English morphology, mixed identifier и negative queries. Automated verification MUST проверять Top 1 для exact structured cases, expected Top K для остальных cases, Recall@5, MRR, deterministic ordering и отсутствие результатов чужого проекта или вне выбранной публикации.

#### Scenario: Exact regression
- **WHEN** eval выполняется для known exact technical references
- **THEN** expected `CodeBinding` MUST находиться на позиции 1

#### Scenario: Lexical recall regression
- **WHEN** eval выполняется для morphology, punctuation и approved typo cases
- **THEN** expected result MUST находиться в configured Top K
- **AND** aggregate Recall@5 и MRR MUST быть не ниже versioned accepted baseline

#### Scenario: Negative fuzzy regression
- **WHEN** eval выполняется для unrelated или слишком короткого fuzzy query
- **THEN** service MUST NOT возвращать шумовой trigram result выше configured acceptance boundary

### Requirement: Bounded and observable lexical search
Каждый lexical channel MUST иметь hard candidate limit и выполняться только внутри выбранной опубликованной публикации доверенного проекта с filters до expensive ranking/snippet operations. Service SHALL измерять latency, candidate/result count, zero-result outcome и match channel без raw query и high-cardinality project/publication labels по умолчанию.

#### Scenario: Candidate window ограничено
- **WHEN** lexical channel имеет больше совпадений, чем configured limit
- **THEN** repository SHALL читать не более configured candidate limit до fusion

#### Scenario: Raw query не логируется
- **WHEN** service записывает стандартные logs и metrics поискового запроса
- **THEN** raw query MUST NOT включаться по умолчанию

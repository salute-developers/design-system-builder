## MODIFIED Requirements

### Requirement: Private combined documentation search
Service SHALL предоставлять private project-scoped lexical search по active publication, объединяющий normalized exact/prefix/trigram `StructuredLookupTerm` и technical/Russian/English PostgreSQL FTS `KnowledgeChunk` без semantic/vector search, embedding provider, LLM или network dependency.

#### Scenario: Technical reference найден
- **WHEN** query после canonical normalization точно совпадает с variation reference `Avatar.Xxl`
- **THEN** structured result SHALL находиться в exact-reference tier выше non-exact lexical results
- **AND** result SHALL содержать `codeBindingId`, subject, kind, name, matched term, term type и exact match type

#### Scenario: Markdown найден полнотекстово
- **WHEN** query совпадает с technical, Russian или English FTS projection опубликованного chunk
- **THEN** result SHALL содержать `kbUrl`, title, match-centered plain-text snippet, page path, subjects и explainable match type

#### Scenario: Внешний inference отсутствует
- **WHEN** service выполняет indexing или search
- **THEN** service MUST NOT вызывать embedding provider, LLM или другой network retrieval dependency

### Requirement: Предсказуемое ранжирование без vectors
Service MUST ранжировать exact structured reference выше exact subject/name/other structured terms, после чего MUST детерминированно объединять structured prefix/trigram и technical/Russian/English FTS channels через versioned weighted reciprocal-rank fusion; service MUST дедуплицировать результаты по `codeBindingId` или `kbUrl` и MUST NOT публиковать fusion score как стабильный API contract.

#### Scenario: Structured и markdown совпадают одновременно
- **WHEN** одна query даёт exact structured reference и FTS match
- **THEN** exact structured result SHALL быть раньше FTS result

#### Scenario: Слабый prefix и сильный FTS совпадают одновременно
- **WHEN** structured channel возвращает общий prefix match, а markdown channel возвращает высокоранговое совпадение в title или heading
- **THEN** оба результата SHALL участвовать в rank fusion без безусловного приоритета prefix result

#### Scenario: Один результат найден несколькими каналами
- **WHEN** один chunk или `CodeBinding` найден несколькими representations/channels
- **THEN** response SHALL содержать один logical result с strongest evidence и стабильным tie-breaker

#### Scenario: Один binding имеет больше terms, чем candidate limit
- **WHEN** один `CodeBinding` имеет больше совпавших lookup terms, чем channel candidate limit, и существуют другие совпавшие bindings
- **THEN** repository MUST выбрать strongest term каждого `codeBindingId` до применения candidate limit
- **AND** один binding MUST NOT занимать несколько позиций logical candidate window

#### Scenario: Повторный запрос стабилен
- **WHEN** одинаковый запрос с одинаковыми filters выполняется повторно для неизменной active publication и ranking profile
- **THEN** порядок и pagination результатов SHALL быть одинаковыми

#### Scenario: Размер страницы не меняет Top N
- **WHEN** одинаковый query выполняется с разными response limits
- **THEN** общий repository candidate window SHALL оставаться одинаковым
- **AND** меньшая page SHALL быть префиксом большей page

## ADDED Requirements

### Requirement: Canonical lexical query normalization
Service MUST нормализовать query и индексируемые technical terms одной versioned canonical функцией: выполнять Unicode normalization, trim, collapse whitespace и case normalization, сохранять `.`, `-`, `_`, `:`, `@`, `?` в exact representation и строить дополнительную token representation для CamelCase, qualified, kebab-case и snake_case identifiers. Default search MUST трактовать query как literal text и MUST NOT неявно интерпретировать `-`, кавычки или `OR` как advanced query operators.

#### Scenario: Hyphenated identifier сохранён
- **WHEN** client ищет `size-72`
- **THEN** exact representation SHALL сохранить `size-72`
- **AND** token representation SHALL позволить lexical match по `size` и `72`

#### Scenario: Qualified CamelCase name нормализовано
- **WHEN** client ищет `com.sdds.AvatarStyles`
- **THEN** service SHALL сохранить full qualified exact representation
- **AND** SHALL построить searchable tokens для `com`, `sdds`, `avatar` и `styles`

#### Scenario: Query пуста после нормализации
- **WHEN** query не содержит searchable exact value или tokens
- **THEN** endpoint MUST вернуть `400 Bad Request`

#### Scenario: SQL wildcard punctuation трактуется буквально
- **WHEN** query содержит `_`, `%` или `\`
- **THEN** structured prefix lookup MUST сравнивать символы буквально
- **AND** MUST NOT применять к query wildcard или escape semantics SQL `LIKE`
- **AND** production-like PostgreSQL plan SHALL использовать dedicated prefix index вместо полного scan lookup terms

### Requirement: Complete structured lookup term coverage
Structured adapters MUST строить terms по доступным полям source contract: `subject`, `kind`, `name`, parameter names,
parameter values, parameter code names, variation references, short class names и qualified class names. Stable term types
MUST быть соответственно `subject`, `kind`, `name`, `param-name`, `param-value`, `code-name`, `reference`, `class-name`
и `qualified-name`.

#### Scenario: Component info содержит все обязательные technical fields
- **WHEN** component artifact содержит parameter value/codeName, variation reference и short/qualified class names
- **THEN** каждый доступный field MUST создать canonical lookup term с соответствующим stable term type

### Requirement: Bounded typo-tolerant structured lookup
Service SHALL выполнять trigram matching только по normalized structured lookup terms и ограниченным technical metadata fields после publication/subject filters; service MUST применять configured minimum query length, similarity threshold и hard candidate limit до application ranking.

#### Scenario: Технический термин содержит опечатку
- **WHEN** query `AvatrStyles` превышает minimum fuzzy length и similarity с `AvatarStyles` достигает threshold
- **THEN** service SHALL вернуть соответствующий `CodeBinding` с `matchType = trigram`

#### Scenario: Короткий fuzzy query
- **WHEN** query короче configured fuzzy minimum
- **THEN** service MUST NOT запускать trigram channel

#### Scenario: Subject filter ограничивает fuzzy candidates
- **WHEN** client передаёт subjects вместе с typo query
- **THEN** trigram channel SHALL применить subject filter до candidate limit

### Requirement: Multilingual and technical markdown projections
Service MUST индексировать каждый published `KnowledgeChunk` в independently queryable technical `simple`, Russian и English FTS projections. Title и headings MUST иметь больший вес, чем body; subjects MUST входить в technical projection; page/source paths и code text MUST быть searchable без stemming; natural-language body MUST участвовать в Russian и English morphology search.

#### Scenario: Русская словоформа найдена
- **WHEN** русский query и опубликованный chunk содержат разные словоформы одного индексируемого lexeme
- **THEN** Russian FTS channel SHALL вернуть chunk

#### Scenario: Английская словоформа найдена
- **WHEN** английский query и опубликованный chunk содержат разные словоформы одного индексируемого lexeme
- **THEN** English FTS channel SHALL вернуть chunk

#### Scenario: Technical path найден
- **WHEN** query совпадает с technical token в page/source path или code block
- **THEN** technical FTS channel SHALL вернуть chunk без требования natural-language stemming

#### Scenario: CamelCase identifier найден симметрично
- **WHEN** query `AiInputStyle.mode` совпадает с identifier в code или markdown body
- **THEN** query и technical projection SHALL использовать raw и canonical token representations
- **AND** technical FTS channel SHALL вернуть соответствующий chunk

#### Scenario: Документация компонента выше частого body match
- **WHEN** query `Button` terminal-token совпадает с title `BasicButton`, а `ButtonGroup` чаще упоминает `Button` в body
- **THEN** `BasicButton` documentation SHALL находиться выше `ButtonGroup`
- **AND** response SHALL объяснять `matchType = title-token-suffix`

#### Scenario: Cross-language translation не выполняется
- **WHEN** query и документ выражают одно понятие на разных языках без общего lexical term или управляемого alias
- **THEN** service SHALL NOT обещать совпадение за счёт автоматического перевода или semantic inference

### Requirement: Safe match-centered snippets
Service SHALL формировать для отобранного markdown result bounded plain-text snippet вокруг релевантного lexical match, MUST NOT возвращать snippet как доверенный HTML и MUST использовать bounded начало очищенного текста только как fallback.

#### Scenario: Совпадение находится в середине chunk
- **WHEN** совпавшие terms находятся за пределами начала chunk
- **THEN** snippet SHALL содержать область вокруг совпадения, а не первые фиксированные символы chunk

#### Scenario: Snippet не содержит HTML contract
- **WHEN** source content содержит markup-подобный текст
- **THEN** snippet SHALL оставаться plain text и MUST NOT требовать от клиента доверять или исполнять HTML highlight markup

### Requirement: Backward-compatible explainable search response
Search response SHALL сохранять существующие discriminated result types и обязательные поля и SHALL добавлять backward-compatible metadata, достаточные для объяснения lexical match: `matchType`, а для markdown при наличии — matched fields, для structured — matched term и term type. Numeric database/fusion score MUST NOT считаться стабильным публичным контрактом.

#### Scenario: Старый клиент читает результат
- **WHEN** client игнорирует новые optional metadata fields
- **THEN** existing result fields SHALL сохранять прежнюю семантику и response SHALL оставаться декодируемым

#### Scenario: Клиент объясняет structured match
- **WHEN** structured result найден по reference, prefix или trigram
- **THEN** response SHALL явно сообщить match type, matched term и term type

### Requirement: Versioned lexical-search quality regression
Repository MUST содержать sanitized versioned eval corpus для exact, normalized, prefix, typo, punctuation, Russian morphology, English morphology, mixed identifier и negative queries. Automated verification MUST проверять Top 1 для exact structured cases, expected Top K для остальных cases, Recall@5, MRR, deterministic ordering и отсутствие cross-project/non-active results.

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
Каждый lexical channel MUST иметь hard candidate limit и выполняться только внутри trusted project active publication с filters до expensive ranking/snippet operations. Service SHALL измерять latency, candidate/result count, zero-result outcome и match channel без raw query и high-cardinality project/publication labels по умолчанию.

#### Scenario: Candidate window ограничено
- **WHEN** lexical channel имеет больше совпадений, чем configured limit
- **THEN** repository SHALL читать не более configured candidate limit до fusion

#### Scenario: Raw query не логируется
- **WHEN** service записывает стандартные logs и metrics поискового запроса
- **THEN** raw query MUST NOT включаться по умолчанию

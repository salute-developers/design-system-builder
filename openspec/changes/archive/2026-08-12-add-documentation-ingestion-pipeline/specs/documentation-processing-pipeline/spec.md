## ADDED Requirements

### Requirement: PostgreSQL-backed обработка accepted job
Documentation service MUST асинхронно claim-ить eligible `accepted` job через PostgreSQL lease без удержания database transaction на время обработки.

#### Scenario: Worker забирает accepted job
- **WHEN** свободный worker находит `accepted` job
- **THEN** он SHALL атомарно назначить `workerId`, `leaseUntil`, увеличить `attempt` и начать `validating`

#### Scenario: Два worker конкурируют за job
- **WHEN** несколько worker одновременно выбирают одну eligible job
- **THEN** только один worker SHALL получить активную lease

#### Scenario: Lease истекла
- **WHEN** worker перестал продлевать lease до `leaseUntil`
- **THEN** другой worker MAY claim-ить job для повторного attempt
- **AND** прежний worker MUST NOT индексировать или опубликовать результат после потери lease
- **AND** indexing MUST атомарно проверить `jobId`, `workerId`, `attempt`, действующую lease и статус publication `candidate` до изменения normalized/indexed rows

### Requirement: State machine и retry policy
Job MUST проходить состояния `accepted`, `validating`, `normalizing`, `chunking`, `indexing`, `publishing` и terminal `published` либо `failed`; retry MUST применяться только к классифицированным transient infrastructure failures в пределах configured attempts.

#### Scenario: Успешная обработка
- **WHEN** все стадии candidate pipeline завершились успешно
- **THEN** job SHALL последовательно дойти до `published`

#### Scenario: Контентная ошибка
- **WHEN** deep validation обнаруживает blocking error
- **THEN** job MUST перейти в `failed` без автоматического retry

#### Scenario: Временная ошибка storage
- **WHEN** S3 операция завершается классифицированным transient failure и attempts не исчерпаны
- **THEN** job SHALL стать eligible для повторной обработки

### Requirement: Безопасное извлечение raw bundle
Worker MUST проверить persisted SHA-256 raw object и извлечь archive в isolated temporary directory с path и decompression limits, эквивалентными acceptance safety policy.

#### Scenario: Raw object изменён
- **WHEN** вычисленный SHA-256 скачанного object не совпадает с metadata bundle
- **THEN** job MUST завершиться `failed` с безопасной diagnostic

#### Scenario: Temporary data очищаются
- **WHEN** attempt завершается success, failure или cancellation
- **THEN** worker MUST удалить temporary extracted files

### Requirement: Глубокая валидация документации
Worker MUST проверить schema `docs.json`, navigation, уникальность page paths, безопасные существующие `contentRefs`, UTF-8 markdown, subjects, local markdown links/assets и declared artifacts до нормализации.

#### Scenario: Content reference отсутствует
- **WHEN** page ссылается на отсутствующий content file
- **THEN** job MUST получить error `MISSING_CONTENT_REF` с bundle-relative path
- **AND** candidate MUST NOT быть опубликована

#### Scenario: Page path повторяется
- **WHEN** итоговая navigation содержит один page path более одного раза
- **THEN** deep validation MUST завершиться blocking error

#### Scenario: Страница без subjects
- **WHEN** валидная page не содержит subjects
- **THEN** validator SHALL сохранить warning
- **AND** warning MUST NOT блокировать публикацию

### Requirement: Нормализованная candidate publication
Pipeline MUST создать candidate publication, ordered navigation, pages, content metadata, asset metadata и immutable publication objects, связанные с source bundle.

#### Scenario: Страница содержит несколько contentRefs
- **WHEN** page содержит ordered Core и User contentRefs
- **THEN** normalization SHALL сохранить порядок и source каждого content file

#### Scenario: Candidate не видна до публикации
- **WHEN** job находится до terminal `published`
- **THEN** private read/search API MUST NOT возвращать candidate как active publication

### Requirement: Markdown chunking и FTS projection
Pipeline MUST разбирать markdown через AST, создавать `KnowledgeChunk` по heading boundaries без разрыва atomic blocks и строить PostgreSQL FTS projection с subjects и техническими identifiers. Configured `targetBytes` и `maxBytes`, а также persisted approximate size MUST измеряться в UTF-8 bytes.

#### Scenario: H2 создаёт chunks
- **WHEN** markdown page содержит несколько H2 sections
- **THEN** каждая H2 section SHALL создать ordered chunk с page context и heading path

#### Scenario: H2 отсутствует
- **WHEN** markdown page не содержит H2
- **THEN** весь content SHALL стать одним chunk, если он не превышает configured maximum

#### Scenario: Code block не разрезается
- **WHEN** chunk превышает target size из-за fenced code block
- **THEN** chunker MUST NOT разделять fenced code block посередине

#### Scenario: Обычный text block превышает maximum
- **WHEN** отдельный paragraph или другой non-atomic text block превышает configured `maxBytes`
- **THEN** chunker MUST разделить его по безопасным UTF-8 boundaries с предпочтением word/sentence boundary
- **AND** каждая полученная часть MUST иметь UTF-8 размер не больше `maxBytes`

### Requirement: Атомарное переключение active publication
Pipeline MUST переключать active publication для `(projectId, designSystemId, version, platform)` одной database transaction только после успешного построения всех normalized и indexed данных.

#### Scenario: Повторная публикация успешна
- **WHEN** новая candidate для уже опубликованного ключа успешно завершена
- **THEN** active pointer SHALL перейти на новую publication
- **AND** предыдущая publication SHALL стать `superseded`

#### Scenario: Повторная публикация неуспешна
- **WHEN** новая candidate завершается `failed`
- **THEN** предыдущий active pointer MUST остаться неизменным

### Requirement: Единая диагностика processing
Job MUST сохранять diagnostics с `level`, `code`, `message` и optional `path`, `artifactType`, `subject`, `details`; diagnostics MUST NOT раскрывать filesystem paths, credentials или internal URLs.

#### Scenario: Клиент читает failed job
- **WHEN** authorized client запрашивает status failed job
- **THEN** response SHALL вернуть сохранённые diagnostics с bundle-relative paths

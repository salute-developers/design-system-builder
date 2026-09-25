# documentation-processing-pipeline Specification
## Purpose
TBD - created by archiving change add-documentation-ingestion-pipeline. Update Purpose after archive.
## Requirements
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
Конвейер MUST публиковать проверенную документацию как новый полный снимок для ключа `(projectId, designSystemId, version, platform)` и MUST атомарно переключать `active_documentation_publications` на этот снимок. Если активная публикация для ключа уже существовала, та же транзакция MUST перевести её в `superseded` и MUST создать связанное задание очистки с защитной задержкой. До успешного завершения транзакции прежняя публикация MUST оставаться активной и не должна быть доступна обработчику очистки.

#### Scenario: Первая публикация ключа
- **WHEN** проверенный пакет публикуется для ключа, у которого нет активной публикации
- **THEN** система создаёт новый полный снимок и активный указатель
- **AND** система не создаёт задание очистки

#### Scenario: Повторная публикация того же ключа
- **WHEN** проверенный пакет публикуется для ключа с существующей активной публикацией
- **THEN** система в одной транзакции активирует новый снимок, переводит прежний снимок в `superseded` и создаёт для него задание очистки
- **AND** чтение после фиксации транзакции разрешает только новый снимок

#### Scenario: Публикация не зафиксирована
- **WHEN** транзакция повторной публикации завершается ошибкой
- **THEN** прежняя публикация остаётся активной
- **AND** задание очистки для неё отсутствует

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

### Requirement: Асинхронная очистка заменённой публикации
Система MUST удалять тяжёлые данные публикации только после того, как связанное задание достигло `eligible_at`, публикация остаётся в состоянии `superseded` и ни один активный указатель на неё не существует. Очистка MUST удалять только точные ключи S3 и строки PostgreSQL, принадлежащие этой публикации. Публикации других версий или платформ MUST оставаться неизменными.

#### Scenario: Готовое задание успешно очищено
- **GIVEN** защитная задержка истекла и публикация остаётся заменённой
- **WHEN** обработчик захватывает задание
- **THEN** он удаляет точные объекты публикации и исходного пакета из S3
- **AND** завершающая транзакция повторно проверяет отсутствие активного указателя, удаляет публикацию с зависимыми строками и отмечает `documentation_bundles.storage_deleted_at`
- **AND** связанное задание удаляется каскадно

#### Scenario: Другая версия остаётся доступной
- **GIVEN** дизайн-система имеет публикации версий `1.0.0` и `2.0.0`
- **WHEN** повторная публикация `2.0.0` приводит к очистке её прежнего снимка
- **THEN** публикация `1.0.0`, её строки PostgreSQL и объекты S3 не изменяются

#### Scenario: Публикация снова активна
- **GIVEN** обработчик захватил задание очистки
- **WHEN** завершающая проверка обнаруживает активный указатель на публикацию
- **THEN** система не удаляет строки публикации
- **AND** переводит задание в `blocked` с безопасным классом причины

### Requirement: Восстанавливаемое и идемпотентное выполнение очистки
Система MUST захватывать задания с арендой ограниченного срока, MUST не позволять обработчику завершить задание после потери аренды и MUST безопасно повторять незавершённую очистку. Отсутствующий при повторе объект S3 MUST считаться успешно удалённым. Временные ошибки MUST приводить к повторной попытке с ограниченной экспоненциальной задержкой.

#### Scenario: Процесс остановился после частичного удаления S3
- **GIVEN** обработчик удалил часть объектов и завершился до транзакции PostgreSQL
- **WHEN** аренда истекла и другой обработчик повторно захватил задание
- **THEN** повторное удаление отсутствующих и оставшихся объектов завершается безопасно
- **AND** публикация удаляется только после повторной проверки активного указателя

#### Scenario: Прежний обработчик потерял аренду
- **GIVEN** срок аренды истёк и задание захвачено другим обработчиком
- **WHEN** прежний обработчик пытается завершить задание
- **THEN** репозиторий отклоняет завершение
- **AND** прежний обработчик не удаляет строки PostgreSQL

#### Scenario: Временная ошибка хранилища объектов
- **WHEN** S3 возвращает временную ошибку удаления
- **THEN** система сохраняет ограниченный класс ошибки и переводит задание в `retry_wait`
- **AND** `next_attempt_at` вычисляется в пределах настроенных минимальной и максимальной задержек

### Requirement: Безопасная конфигурация и миграция
Система MUST поддерживать `documentation.cleanup.enabled`, `documentation.cleanup.graceSeconds`, параметры аренды, опроса и повторов. Обработчик MUST быть выключен по умолчанию, а `graceSeconds` MUST по умолчанию равняться `86400`. Миграция MUST создать задания для существующих заменённых публикаций с фиксированной задержкой 24 часа от момента миграции независимо от конфигурации приложения.

#### Scenario: Приложение развёрнуто без явного включения
- **WHEN** новая версия запускается без `documentation.cleanup.enabled`
- **THEN** публикация продолжает создавать задания очистки
- **AND** фоновый обработчик не захватывает задания

#### Scenario: Миграция обнаружила существующую заменённую публикацию
- **WHEN** миграция выполняется для публикации в состоянии `superseded`
- **THEN** она создаёт ровно одно задание очистки
- **AND** устанавливает `eligible_at` на 24 часа позже времени миграции

### Requirement: Наблюдаемость жизненного цикла публикации
Система MUST предоставлять низкокардинальные метрики количества созданных, завершённых, повторённых и заблокированных заданий, длительности попыток, удалённых байтов, размера очереди, возраста старейшего готового задания и истёкших аренд. Идентификаторы проекта, дизайн-системы, публикации и ключи S3 MUST NOT использоваться как метки метрик. Недоступность очистки MUST NOT изменять готовность операций публикации, чтения и поиска.

#### Scenario: Очистка завершилась успешно
- **WHEN** обработчик завершает очистку публикации
- **THEN** система записывает результат, длительность и число удалённых байтов в метрики
- **AND** структурированный журнал содержит идентификатор публикации в теле записи, а не в метках метрик

#### Scenario: Очередь не обрабатывается
- **WHEN** готовые задания накапливаются
- **THEN** размер очереди и возраст старейшего готового задания отражают задержку
- **AND** `/health/ready` продолжает описывать готовность основных операций сервиса без зависимости от фоновой очистки

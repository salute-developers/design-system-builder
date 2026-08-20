## ADDED Requirements

### Requirement: Private combined documentation search
Service SHALL предоставлять private project-scoped search по active publication, объединяющий exact/normalized `StructuredLookupTerm` и PostgreSQL FTS `KnowledgeChunk` без semantic/vector search.

#### Scenario: Technical reference найден
- **WHEN** query точно совпадает с variation reference `Avatar.Xxl`
- **THEN** structured result SHALL находиться выше markdown FTS results
- **AND** result SHALL содержать `codeBindingId`, subject, kind, name и matched term

#### Scenario: Markdown найден полнотекстово
- **WHEN** query совпадает с индексируемым текстом опубликованного chunk
- **THEN** result SHALL содержать `kbUrl`, title, snippet, page path, subjects и rank

### Requirement: Ограничение поиска active publication и filters
Search MUST принимать `designSystemId`, `version`, canonical `platform`, query и optional subjects и MUST искать только внутри соответствующей active publication trusted project.

#### Scenario: Subject filter указан
- **WHEN** client передаёт один или несколько subjects
- **THEN** structured и markdown channels SHALL вернуть только results, связанные с этими subjects

#### Scenario: Active publication отсутствует
- **WHEN** для запрошенного ключа нет active publication
- **THEN** search MUST вернуть `404 Not Found`

### Requirement: Предсказуемое ранжирование без vectors
Service MUST ранжировать exact structured reference выше exact subject/name, normalized/prefix technical matches и markdown FTS; service MUST NOT вызывать embedding provider или LLM.

#### Scenario: Structured и markdown совпадают одновременно
- **WHEN** одна query даёт exact structured match и FTS match
- **THEN** exact structured match SHALL быть раньше FTS match

### Requirement: Получение KnowledgeResource по kbUrl
Service SHALL предоставлять `GET /documentation/kb/fetch?url={kbUrl}` и возвращать полный опубликованный chunk с source metadata после project authorization.

#### Scenario: Опубликованный chunk получен
- **WHEN** authorized client передаёт валидный `kbUrl` active или явно опубликованной publication своего project
- **THEN** response SHALL содержать markdown/text fragment, heading path, subjects, page/source paths и publication metadata

#### Scenario: kbUrl не является секретом
- **WHEN** client передаёт `kbUrl` publication другого project
- **THEN** service MUST вернуть `404 Not Found`
- **AND** MUST NOT обходить project authorization из-за знания URL

### Requirement: Стабильность kbUrl внутри publication
Каждый chunk MUST иметь детерминированный `kbUrl`, стабильный для retry одной publication и не обязанный сохраняться после новой publication того же design system/version/platform.

#### Scenario: Worker повторяет attempt
- **WHEN** job повторно строит тот же chunk своей candidate publication
- **THEN** chunk SHALL получить тот же `kbUrl`

## MODIFIED Requirements

### Requirement: Private combined documentation search
Service SHALL предоставлять private project-scoped lexical search по active publication только actor с permission `documentation:read`, объединяя normalized exact/prefix/trigram `StructuredLookupTerm` и technical/Russian/English PostgreSQL FTS `KnowledgeChunk` без semantic/vector search, embedding provider, LLM или network dependency.

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

## ADDED Requirements

### Requirement: Authorized KnowledgeResource fetch

Service MUST требовать permission `documentation:read` до получения KnowledgeResource по `kbUrl` и MUST сохранить существующую project ownership проверку.

#### Scenario: Project key получает chunk со scope

- **WHEN** trusted project key actor имеет `documentation:read` и передаёт `kbUrl` resource своего project
- **THEN** service SHALL вернуть опубликованный chunk

#### Scenario: Actor со scope знает URL другого project

- **WHEN** actor с `documentation:read` передаёт `kbUrl` publication другого project
- **THEN** service MUST вернуть `404 Not Found`

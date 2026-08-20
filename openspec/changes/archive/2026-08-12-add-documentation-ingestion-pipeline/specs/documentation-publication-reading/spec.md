## ADDED Requirements

### Requirement: Project-scoped private authorization чтения
Gateway MUST проксировать documentation read endpoints только через `/api/projects/{projectId}/documentation/...` с existing project auth и trusted context; service MUST проверять принадлежность job/publication trusted project.

#### Scenario: Publication другого project скрыта
- **WHEN** actor запрашивает publication, не принадлежащую trusted project
- **THEN** service MUST вернуть `404 Not Found` без раскрытия её существования

#### Scenario: Anonymous route отсутствует
- **WHEN** клиент пытается читать documentation без project-scoped authentication
- **THEN** Gateway MUST отклонить request

### Requirement: Status ingestion job
Service SHALL предоставлять `GET /documentation/ingestion-jobs/{jobId}` с явным DTO статуса, progress и diagnostics.

#### Scenario: Processing job прочитана
- **WHEN** authorized client запрашивает job своего project
- **THEN** response SHALL содержать `jobId`, `status`, current step, attempt, timestamps и diagnostics

### Requirement: Чтение active publication
Service SHALL предоставлять active publication по `designSystemId`, `version` и canonical `platform` и MUST возвращать только успешно опубликованный active pointer.

#### Scenario: Active publication найдена
- **WHEN** authorized client запрашивает опубликованный ключ
- **THEN** response SHALL содержать `publicationId`, design system, version, platform, status и publication timestamp

#### Scenario: Есть только candidate
- **WHEN** для ключа существует candidate, но active publication отсутствует
- **THEN** endpoint MUST вернуть `404 Not Found`

### Requirement: Чтение navigation и page
Service SHALL предоставлять ordered navigation и page по normalized path с explicit response DTO, content, subjects и связанными assets.

#### Scenario: Page с несколькими content sources
- **WHEN** page содержит Core и User content
- **THEN** response SHALL вернуть content blocks в нормализованном порядке с source metadata

### Requirement: Авторизованная выдача asset
Service SHALL выдавать asset только в контексте publication и MUST применять ту же project authorization, что и к page.

#### Scenario: Asset опубликованной page прочитан
- **WHEN** authorized client запрашивает существующий asset active или явно доступной published publication
- **THEN** service SHALL вернуть bytes либо безопасную download response с media type и metadata

### Requirement: Чтение и listing CodeBinding
Service SHALL предоставлять exact `CodeBinding` по ID и cursor-paginated listing с optional filters `subject`, `kind`, `name`.

#### Scenario: Exact binding прочитана
- **WHEN** authorized client запрашивает существующий `codeBindingId` publication
- **THEN** response SHALL вернуть canonical fields и полный platform payload

#### Scenario: Listing отфильтрован по subject
- **WHEN** client передаёт `subject=components.avatar`
- **THEN** listing SHALL вернуть только bindings с точным subject и pagination cursor

### Requirement: Ограниченная pagination
Listing endpoints MUST применять configured default limit и MUST отклонять или ограничивать значения выше server maximum.

#### Scenario: Limit не задан
- **WHEN** client не передаёт `limit`
- **THEN** endpoint SHALL использовать default limit `20`

#### Scenario: Limit превышает maximum
- **WHEN** client передаёт `limit` больше `100`
- **THEN** endpoint MUST NOT вернуть более `100` элементов

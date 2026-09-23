## MODIFIED Requirements

### Requirement: Project-scoped private authorization чтения
Gateway MUST проксировать documentation read endpoints только через `/api/projects/{projectId}/documentation/...` с existing project auth и trusted context. Documentation Service MUST требовать permission `documentation:read` и MUST отдельно проверять принадлежность job/publication trusted project.

#### Scenario: User role читает documentation
- **WHEN** trusted user actor имеет effective project role с grant `documentation:read`
- **THEN** Documentation Service SHALL разрешить чтение resource своего project

#### Scenario: Project key читает со scope
- **WHEN** trusted project key actor имеет scope `documentation:read`
- **THEN** Documentation Service SHALL разрешить чтение resource своего project

#### Scenario: Project key читает без scope
- **WHEN** trusted project key actor не имеет scope `documentation:read`
- **THEN** Documentation Service MUST вернуть `403 Forbidden`

#### Scenario: Publication другого project скрыта
- **WHEN** actor с permission `documentation:read` запрашивает publication, не принадлежащую trusted project
- **THEN** service MUST вернуть `404 Not Found` без раскрытия её существования

#### Scenario: Anonymous route отсутствует
- **WHEN** клиент пытается читать documentation без project-scoped authentication
- **THEN** Gateway MUST отклонить request

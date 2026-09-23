## MODIFIED Requirements

### Requirement: Авторизация публикации документации
Documentation service MUST требовать permission `documentation:write` для публикации bundle. User actor получает permission через grants effective project role; project key actor — только при наличии точного scope `documentation:write`; `system_admin` использует global override canonical policy.

#### Scenario: Owner публикует bundle
- **WHEN** сервис получает trusted actor context с `actorType = user` и `projectRole = owner`
- **THEN** policy evaluator SHALL разрешить `documentation:write`
- **AND** сервис SHALL продолжить прием bundle

#### Scenario: Maintainer публикует bundle
- **WHEN** сервис получает trusted actor context с `actorType = user` и `projectRole = maintainer`
- **THEN** policy evaluator SHALL разрешить `documentation:write`
- **AND** сервис SHALL продолжить прием bundle

#### Scenario: Editor публикует bundle
- **WHEN** сервис получает trusted actor context с `actorType = user` и `projectRole = editor`
- **THEN** policy evaluator SHALL разрешить `documentation:write`
- **AND** сервис SHALL продолжить прием bundle

#### Scenario: Viewer не может публиковать bundle
- **WHEN** сервис получает trusted actor context пользователя с ролью `viewer`
- **THEN** сервис MUST вернуть `403 Forbidden`
- **AND** сервис MUST NOT сохранять bundle или создавать ingestion job

#### Scenario: Project key публикует с write scope
- **WHEN** сервис получает trusted actor context с `actorType = project_key`, совпадающим trusted `projectId` и scope `documentation:write`
- **THEN** сервис SHALL разрешить продолжить прием bundle

#### Scenario: Project key публикует без write scope
- **WHEN** сервис получает trusted actor context с `actorType = project_key`, но без scope `documentation:write`
- **THEN** сервис MUST вернуть `403 Forbidden`
- **AND** сервис MUST NOT читать multipart body, сохранять bundle или создавать ingestion job

#### Scenario: Trusted context отсутствует
- **WHEN** upload поступает без обязательного trusted actor/project context
- **THEN** сервис MUST отклонить запрос
- **AND** сервис MUST NOT доверять одноименным headers, не прошедшим через Gateway

## ADDED Requirements

### Requirement: Canonical access-key scope catalog

Projects Service SHALL принимать scopes новых project access keys только из каталога permissions canonical project authorization policy.

#### Scenario: Создание key с известными scopes

- **WHEN** authorized actor создаёт project key со scopes, присутствующими в canonical policy
- **THEN** Projects Service SHALL валидировать и сохранить эти scopes

#### Scenario: Создание key с неизвестным scope

- **WHEN** запрос создания project key содержит scope вне canonical policy
- **THEN** Projects Service MUST отклонить запрос
- **AND** MUST NOT сохранить key с частичным набором scopes

### Requirement: Documentation scopes for project keys

Canonical scope catalog SHALL содержать `documentation:read` и `documentation:write` как независимые project-key permissions.

#### Scenario: Read-only documentation key

- **WHEN** key создаётся со scope `documentation:read` без `documentation:write`
- **THEN** Projects Service SHALL сохранить точный набор scopes
- **AND** key MUST NOT неявно получить `documentation:write`

#### Scenario: Documentation write key

- **WHEN** key создаётся со scope `documentation:write`
- **THEN** Projects Service SHALL сохранить этот scope для передачи Gateway в trusted context

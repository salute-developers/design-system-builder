## ADDED Requirements

### Requirement: Access key creation

Система SHALL позволять Owner и Maintainer создавать project-bound access keys.

#### Scenario: Maintainer создает key

- **WHEN** Maintainer отправляет `POST /projects/{projectId}/access-keys` с валидным name и scopes
- **THEN** система MUST создать access key для указанного project и вернуть raw secret только в response создания

#### Scenario: Viewer пытается создать key

- **WHEN** Viewer отправляет `POST /projects/{projectId}/access-keys`
- **THEN** система MUST вернуть `403 Forbidden`

### Requirement: Access key secret storage

Система SHALL хранить access key secret только в виде hash.

#### Scenario: Key сохранен

- **WHEN** access key создан
- **THEN** persistence MUST содержать hash секрета и MUST NOT содержать raw secret

### Requirement: Access key listing

Система SHALL позволять Owner, Maintainer и `system_admin` просматривать metadata access keys без raw secret.

#### Scenario: Owner получает список keys

- **WHEN** Owner отправляет `GET /projects/{projectId}/access-keys`
- **THEN** система MUST вернуть metadata keys без raw secret

### Requirement: Access key revocation

Система SHALL позволять Owner, Maintainer и `system_admin` отзывать project access keys.

#### Scenario: Key отозван

- **WHEN** Owner отправляет `DELETE /projects/{projectId}/access-keys/{keyId}`
- **THEN** система MUST пометить key как revoked и запретить дальнейшую аутентификацию этим key

### Requirement: Access key scopes

Система SHALL ограничивать project key actor через scopes.

#### Scenario: Key без admin scope пытается управлять members

- **WHEN** project key actor вызывает member-management endpoint
- **THEN** система MUST вернуть `403 Forbidden`

#### Scenario: Key с project read scope читает project

- **WHEN** project key actor со scope `projects:read` читает project metadata
- **THEN** система MUST разрешить read operation

### Requirement: Gateway context for project key actor

Auth Helper SHALL формировать отдельный trusted context для project key actor.

#### Scenario: Access key успешно проверен

- **WHEN** клиент отправляет валидный project access key
- **THEN** Gateway MUST передать downstream `X-Actor-Type: project_key`, `X-Project-Id`, `X-Project-Key-Id` и `X-Project-Scopes`

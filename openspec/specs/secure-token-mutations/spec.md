# secure-token-mutations Specification

## Purpose

Определить авторизацию и проверку принадлежности проекту при записи токенов и их значений через существующие маршруты DS Builder.

## Requirements
### Requirement: Project-scoped authorization for token mutations

`db-service` SHALL authorize writes to existing `/ds/tokens` and `/ds/token-values` routes using trusted Gateway actor context. User actor MUST have `owner`, `maintainer` or `editor` for `POST`/`PATCH`, and `owner` or `maintainer` for `DELETE`. Project key MUST have `tokens:write` for `POST`/`PATCH` and `tokens:delete` for `DELETE`. `system_admin` SHALL retain the platform override. Client-supplied body/query fields MUST NOT replace trusted project context.

#### Scenario: Viewer tries to edit a token
- **WHEN** a `viewer` sends `PATCH` to an existing token or token value through `/api/projects/{projectId}/ds/...`
- **THEN** the API MUST return `403` and MUST NOT change stored data

#### Scenario: Project key lacks write scope
- **WHEN** a project key without `tokens:write` sends `POST` or `PATCH` to a token or token value
- **THEN** the API MUST return `403` and MUST NOT change stored data

#### Scenario: Delete permission is distinct
- **WHEN** an `editor` or a project key without `tokens:delete` sends `DELETE` to a token or token value
- **THEN** the API MUST return `403` and MUST NOT delete the resource

#### Scenario: Missing trusted context
- **WHEN** a public mutation request reaches `db-service` without trusted project context or an explicit trusted internal/admin actor
- **THEN** the API MUST reject the write without using a body/query project ID as authorization

### Requirement: Token definition ownership

Token definition mutation SHALL be restricted to a design system in the trusted project. A project-scoped create request MUST include `designSystemId`; `PATCH` MUST NOT move a token to another design system. Globally available or legacy unscoped token definitions SHALL remain readable under existing read rules but MUST NOT be mutable through project-scoped routes.

#### Scenario: Create in another project
- **WHEN** a caller sends `POST /ds/tokens` with `designSystemId` belonging to another project
- **THEN** the API MUST return `404` and MUST NOT create the token

#### Scenario: Mutate another project's token
- **WHEN** a caller sends `PATCH` or `DELETE /ds/tokens/{id}` for a token outside the trusted project
- **THEN** the API MUST return `404` and MUST NOT change the token

#### Scenario: Legacy unscoped token
- **WHEN** a project-scoped caller attempts to mutate a token whose `designSystemId` is NULL
- **THEN** the API MUST reject the mutation without modifying the token

### Requirement: Token value referential integrity

Token value creation MUST require `tokenId`, `tenantId` and `platform`; token and tenant MUST belong to the same design system in the trusted project. `PATCH` and `DELETE` MUST resolve the stored token and tenant before mutation. If `paletteId` is supplied, it MUST reference an existing row of the current shared palette catalog. The API MUST preserve the existing distinction between a value with no mode and `light`/`dark` values.

#### Scenario: Token and tenant belong to different design systems
- **WHEN** a caller sends `POST /ds/token-values` with a token and tenant from different design systems
- **THEN** the API MUST reject the request and MUST NOT create a value

#### Scenario: Existing value belongs to another project
- **WHEN** a caller sends `PATCH` or `DELETE /ds/token-values/{id}` for a value associated with another project's token or tenant
- **THEN** the API MUST return `404` and MUST NOT change the value

#### Scenario: Missing context or unknown palette
- **WHEN** create request omits `tokenId`, `tenantId` or `platform`, or specifies a nonexistent `paletteId`
- **THEN** the API MUST return a client error and MUST NOT create a value

#### Scenario: Duplicate contextual value
- **WHEN** a create or update would duplicate an existing `(tokenId, tenantId, platform, mode)` combination
- **THEN** the API MUST return a client error without partial mutation

### Requirement: Existing Gateway and API contract remain usable

The secure mutation capability SHALL use the existing `/api/projects/{projectId}/ds/...` Gateway path and CRUD paths. Successful responses SHALL preserve documented token/token-value identity and value fields; authorization and ownership failures SHALL expose stable `403`/`404` semantics in OpenAPI.

#### Scenario: Authorized write survives a fresh read
- **WHEN** an authorized actor creates or updates a token value for a valid token, tenant, platform and mode
- **THEN** the API MUST return the persisted row identity and subsequent authorized read MUST return the stored value

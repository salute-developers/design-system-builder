## ADDED Requirements

### Requirement: Project-scoped token read API
DS Builder model API SHALL provide project-scoped read endpoints for authoritative token and token value data.

#### Scenario: List tokens in design system
- **WHEN** an authenticated client calls `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tokens`
- **THEN** the API MUST return token summaries from the system model source of truth
- **THEN** the response MUST preserve the existing array response shape
- **THEN** the response MUST support optional filters for token type and textual query
- **THEN** db-service MUST verify that the requested design system belongs to trusted `X-Project-Id` or is globally available to that project
- **THEN** db-service MUST require `tokens:read` when request uses project access-key scopes
- **THEN** the response MUST NOT be derived from documentation publications

#### Scenario: Read token by stable ID
- **WHEN** an authenticated client calls `GET /api/projects/{projectId}/ds/tokens/{tokenId}`
- **THEN** the API MUST return the authoritative token DTO with identity, type, display metadata and revision metadata when available
- **THEN** db-service MUST verify that the token belongs to a design system available to the trusted project
- **THEN** the API MUST return `404` when the token does not belong to the trusted project

#### Scenario: Read token values with filters
- **WHEN** an authenticated client calls `GET /api/projects/{projectId}/ds/tokens/{tokenId}/values` with optional tenant, mode or platform filters
- **THEN** the API MUST return authoritative token value DTOs from the system model
- **THEN** the API MUST preserve raw, reference and resolved value metadata when those concepts are present in the source model

#### Scenario: Existing token routes are stabilized
- **WHEN** MCP reads one token or its values by stable ID
- **THEN** the API MUST reuse `/ds/tokens/{tokenId}` and `/ds/tokens/{tokenId}/values`
- **THEN** those routes MUST enforce project ownership and `tokens:read`

### Requirement: Project-scoped component read API
DS Builder model API SHALL provide project-scoped read endpoints for authoritative component, component config, component style and variation data.

#### Scenario: List components in design system
- **WHEN** an authenticated client calls `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/components`
- **THEN** the API MUST return component summaries from the system model source of truth
- **THEN** the response MUST include stable component identifiers and available style names
- **THEN** the response MUST preserve the existing array response shape
- **THEN** the response MUST support optional textual query
- **THEN** db-service MUST verify that the requested design system belongs to trusted `X-Project-Id` or is globally available to that project
- **THEN** db-service MUST require `components:read` when request uses project access-key scopes

#### Scenario: Read component details
- **WHEN** an authenticated client calls `GET /api/projects/{projectId}/ds/components/{componentId}`
- **THEN** the API MUST return authoritative component metadata and available configuration references
- **THEN** db-service MUST verify component membership in a design system available to the trusted project
- **THEN** the API MUST return `404` when the component does not belong to the trusted project

#### Scenario: Read component configuration package
- **WHEN** an authenticated client calls `POST /api/projects/{projectId}/ds/component-config/export` with `designSystemId` and optional `components` or `styles` filters
- **THEN** the API MUST return the authoritative component configuration package with component names, style names and canonical common config
- **THEN** the API MUST limit the package to requested component/style filters when filters are provided
- **THEN** the API MUST require `components:read` when request uses project access-key scopes

#### Scenario: Read one component configuration from package contract
- **WHEN** MCP needs `component_config_get` for one component and optional style
- **THEN** frontend application layer MUST request `POST /ds/component-config/export` with component/style filters when backend supports them
- **THEN** the API MUST return canonical common config

#### Scenario: Read component styles and variations
- **WHEN** an authenticated client calls `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/components/{componentId}/styles` or `GET /api/projects/{projectId}/ds/components/{componentId}/variations`
- **THEN** the API MUST return authoritative style and variation DTOs from the system model
- **THEN** the response MUST include stable identifiers that MCP clients can use to correlate model data with code bindings
- **THEN** only the styles endpoint MUST remain design-system-scoped because it avoids one styles request per variation

### Requirement: No backend pagination in first read tools version
Token and component model reads SHALL avoid introducing backend cursor pagination in this change.

#### Scenario: Existing list shape remains array-based
- **WHEN** token or component list endpoints are extended for MCP reads
- **THEN** the backend MUST keep array-based responses for existing list endpoints
- **THEN** MCP-specific result limiting, if needed, MUST be handled in frontend application or MCP presentation layer

#### Scenario: Existing component routes are stabilized
- **WHEN** implementation reuses existing `/ds/components`, `/ds/styles`, `/ds/variations` or `/ds/component-config/export` logic internally
- **THEN** ID-based component detail and variation reads MUST reuse existing routes with project/scope checks
- **THEN** the external read contract MUST provide aggregate component styles without N+1 requests

### Requirement: Gateway authorization for model read API
Gateway SHALL expose token and component read API through project-scoped authorization and trusted project context.

#### Scenario: Existing gateway route forwards authorized model read request
- **WHEN** an authenticated client calls a token or component read endpoint through `/api/projects/{projectId}/ds/...`
- **THEN** gateway MUST validate project-scoped authentication using existing user session or project access key semantics
- **THEN** gateway MUST forward trusted project/design-system context to the model API implementation
- **THEN** this change MUST NOT require a new gateway route when the existing `/api/projects/{projectId}/ds/...` route covers the endpoint path

#### Scenario: Unauthorized model read request is rejected
- **WHEN** a client calls a token or component read endpoint without valid project-scoped authentication
- **THEN** gateway MUST reject the request with `401` or `403`
- **THEN** db-service MUST NOT receive untrusted project identity from client-controlled request parameters

### Requirement: Stable DTO boundary for model reads
Token and component read endpoints SHALL return explicit API DTOs rather than persistence rows or UI-only shapes.

#### Scenario: API response hides persistence details
- **WHEN** model API returns tokens, token values, components, configs, styles or variations
- **THEN** response DTOs MUST contain stable public fields documented by the API contract
- **THEN** response DTOs MUST NOT expose database-only columns, internal join-table structure or raw implementation-specific rows

#### Scenario: API errors map to client-readable codes
- **WHEN** model API rejects a read request due to invalid arguments, missing entity, authorization failure or backend availability
- **THEN** the API MUST return a status and error body that frontend application use cases can map to stable MCP codes

### Requirement: Web client compatibility
Model read API changes SHALL preserve existing `js/apps/client` behavior unless that client is intentionally migrated in the same implementation.

#### Scenario: Existing web client endpoints remain compatible
- **WHEN** this change adds filters, DTOs or project/scope checks for MCP-oriented model reads
- **THEN** existing endpoints and response shapes used by `js/apps/client` MUST remain backward-compatible
- **THEN** the implementation MUST NOT require unrelated changes in `js/apps/client` only to keep current UI scenarios working

#### Scenario: Frontend Kotlin clients may migrate
- **WHEN** new read DTOs affect `frontend-kt/cli` or shared frontend application use cases
- **THEN** the implementation MAY update `frontend-kt/cli` together with the shared use cases
- **THEN** CLI changes MUST preserve documented command behavior or update CLI documentation in the same change

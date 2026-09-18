## ADDED Requirements

### Requirement: MCP documentation read tools
MCP server SHALL expose read-only documentation tools that use the shared frontend application layer and return structured documentation DTOs.

#### Scenario: Documentation search returns structured results
- **WHEN** MCP client calls `documentation_search` with `query`, resolved project context, design system, version and platform
- **THEN** MCP server MUST call the shared documentation search use case
- **THEN** MCP server MUST return deterministic JSON-compatible results with markdown hits, code-binding hits, snippets, subjects, `kbUrl` values and optional `nextCursor`
- **THEN** MCP server MUST NOT require the client to call shell commands or parse CLI output

#### Scenario: Documentation fetch reads knowledge chunk
- **WHEN** MCP client calls `documentation_fetch` with a `kbUrl` returned by `documentation_search`
- **THEN** MCP server MUST call the shared documentation fetch use case
- **THEN** MCP server MUST return the full published chunk with source metadata or a structured `NOT_FOUND` error

#### Scenario: Documentation navigation and pages read active publication
- **WHEN** MCP client calls `documentation_get_navigation` or `documentation_get_page`
- **THEN** MCP server MUST resolve the active publication for the requested or default version and platform
- **THEN** MCP server MUST return navigation or page DTOs from the documentation service
- **THEN** MCP server MUST return `PUBLICATION_NOT_FOUND` when no active publication exists

### Requirement: MCP code binding read tools
MCP server SHALL expose read-only code binding tools for locating and reading references from published documentation artifacts.

#### Scenario: Code binding search filters by subject and kind
- **WHEN** MCP client calls `code_binding_search` with `subject` and optional `kind`, `name`, `limit` or `cursor`
- **THEN** MCP server MUST call the shared code binding search use case
- **THEN** MCP server MUST return binding IDs, canonical subjects, kinds, names, references and pagination metadata

#### Scenario: Code binding get returns exact reference
- **WHEN** MCP client calls `code_binding_get` with a `bindingId`
- **THEN** MCP server MUST return the exact published binding DTO
- **THEN** MCP server MUST return `NOT_FOUND` when the binding is absent or outside the authorized project

#### Scenario: Code bindings are not authoritative system model
- **WHEN** MCP client reads a token or component through `code_binding_get`
- **THEN** MCP server MUST identify the result as documentation/code-reference data
- **THEN** MCP server MUST NOT present code binding data as authoritative token or component configuration state

### Requirement: MCP token read tools
MCP server SHALL expose read-only token tools that read authoritative token data from DS Builder model API.

#### Scenario: Token list reads system tokens
- **WHEN** MCP client calls `tokens_list` with optional `type`, `query` or `limit`
- **THEN** MCP server MUST call the shared token list use case backed by DS Builder model API
- **THEN** MCP server MUST return token summaries with IDs, names, types, display names and descriptions
- **THEN** MCP server MUST apply `limit` in the frontend application or MCP presentation layer when backend returns an array response
- **THEN** MCP server MUST NOT reconstruct the list from documentation artifacts

#### Scenario: Token get reads one system token
- **WHEN** MCP client calls `token_get` with `tokenId` or `name`
- **THEN** MCP server MUST return the authoritative token DTO from DS Builder model API
- **THEN** the result MUST include token identity, type, display metadata, available references and revision metadata when the backend provides it

#### Scenario: Token values get reads resolved values
- **WHEN** MCP client calls `token_values_get` with a token identifier and optional tenant, theme, mode or platform filters
- **THEN** MCP server MUST return authoritative token values from DS Builder model API
- **THEN** MCP server MUST preserve enough value metadata to distinguish raw, referenced and resolved values when the backend provides it

### Requirement: MCP component read tools
MCP server SHALL expose read-only component tools that read authoritative component data from DS Builder model API.

#### Scenario: Component list reads system components
- **WHEN** MCP client calls `components_list` with optional `query`, `platform` or `limit`
- **THEN** MCP server MUST call the shared component list use case backed by DS Builder model API
- **THEN** MCP server MUST return component summaries and available style names
- **THEN** MCP server MUST apply `limit` in the frontend application or MCP presentation layer when backend returns an array response
- **THEN** MCP server MUST NOT reconstruct the list from documentation artifacts

#### Scenario: Component config get reads authoritative config
- **WHEN** MCP client calls `component_config_get` with component identifier and optional style identifier
- **THEN** MCP server MUST return authoritative component configuration from DS Builder model API
- **THEN** MCP server MUST return canonical common config
- **THEN** the result MUST include props, bindings, invariants, variations and revision metadata when the backend provides it

#### Scenario: Component styles and variations read model details
- **WHEN** MCP client calls `component_styles_get` or `component_variations_get`
- **THEN** MCP server MUST return style and variation details from DS Builder model API
- **THEN** MCP server MUST preserve component/style identifiers needed for a future write tool to address the same system entity

### Requirement: MCP read tool safety and errors
Expanded read tools SHALL preserve the existing MCP security and diagnostics model.

#### Scenario: Read tools do not expose credentials
- **WHEN** any new MCP read tool returns success or failure
- **THEN** the response MUST NOT contain project keys, access tokens, refresh tokens, passwords or raw credential headers

#### Scenario: Backend and validation failures map to stable errors
- **WHEN** a new MCP read tool receives invalid input or backend returns an authorization, availability or not-found failure
- **THEN** MCP server MUST return a structured error with stable code `INVALID_ARGUMENT`, `INVALID_QUERY`, `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `PUBLICATION_NOT_FOUND`, `BACKEND_UNAVAILABLE` or `CONTEXT_NOT_FOUND`
- **THEN** MCP server MUST NOT include stack traces in the tool result body

#### Scenario: Expanded tools stay read-only
- **WHEN** MCP client lists available tools after this change
- **THEN** token and component tools MUST include only read operations
- **THEN** MCP server MUST NOT expose `token_create`, `token_update`, `token_delete`, `token_value_set`, `component_config_update` or other mutating token/component tools in this change

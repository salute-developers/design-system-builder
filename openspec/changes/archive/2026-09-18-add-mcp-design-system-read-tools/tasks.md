## 1. Backend model read API

- [x] 1.1 Inspect existing `js/services/db-service/src/routes/api/` token, token value, component, style, variation and `component-config/export` routes and map each required MCP read tool to an existing handler or a narrowly scoped handler addition.
- [x] 1.2 Add trusted project checks and `tokens:read` scope checks to design-system token subresources used by MCP.
- [x] 1.3 Add `type` and `query` support to `GET /ds/design-systems/{designSystemId}/tokens` while preserving the existing array response shape.
- [x] 1.4 Add token lookup/value handlers for `GET /ds/design-systems/{designSystemId}/tokens/{tokenIdOrName}` and `GET /ds/design-systems/{designSystemId}/tokens/{tokenIdOrName}/values` with design-system-local matching and filters.
- [x] 1.5 Add trusted project checks and `components:read` scope checks to design-system component subresources used by MCP.
- [x] 1.6 Add `query` support to `GET /ds/design-systems/{designSystemId}/components` while preserving the existing array response shape.
- [x] 1.7 Add component lookup/style/variation handlers for `GET /ds/design-systems/{designSystemId}/components/{componentIdOrName}`, `/styles` and `/variations` with design-system-local matching.
- [x] 1.8 Extend `POST /ds/component-config/export` request with optional `components` and `styles` filters and apply them before returning the package.
- [x] 1.9 Update `js/services/db-service/src/openapi/spec.ts` for stabilized token/component subresource DTOs and filtered `component-config/export`.
- [x] 1.10 If db-service route tests are added, stand up the local test runner explicitly; otherwise document the manual verification route for this change.
  - Manual route verification: exercise `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tokens?type=color&query=accent`, `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tokens/{tokenIdOrName}/values?tenantId={tenantId}&platform=web&mode=light`, `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/components?query=button`, `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/components/{componentIdOrName}/styles`, `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/components/{componentIdOrName}/variations`, and `POST /api/projects/{projectId}/ds/component-config/export` with `components`/`styles` filters through the gateway using project credentials.
- [x] 1.11 Verify existing `js/apps/client` routes and response shapes remain backward-compatible after API changes.

## 2. Gateway and authorization

- [x] 2.1 Verify existing gateway route `/api/projects/{projectId}/ds/...` forwards token/component read endpoints and `component-config/export` to db-service with trusted headers.
- [x] 2.2 Ensure db-service handlers use trusted `X-Project-Id`/`X-Project-Scopes` headers and do not rely on client-controlled project identity inside request bodies or query parameters.
- [x] 2.3 Verify project access-key/user-session read scopes for token and component endpoints and update scope configuration if required.

## 3. Frontend application layer

- [x] 3.1 Add `feature-docs` read use cases and ports for documentation search, fetch, active publication navigation/page reads and code binding reads.
- [x] 3.2 Add token read use cases and ports in `feature-theme` for token list/get/value reads.
- [x] 3.3 Add component read use cases and ports in `feature-components` for component list/get/config/styles/variations reads.
- [x] 3.4 Implement data adapters that call backend/gateway APIs through existing `core-network`, credential and context resolution mechanisms.
- [x] 3.5 Adapt `frontend-kt/cli` callers only where shared DTO/use-case changes require it, preserving documented CLI behavior.
- [x] 3.6 Add focused unit tests for use cases, DTO mapping, input validation and backend error mapping.

## 4. MCP server tools

- [x] 4.1 Extend `:mcp-server-core` tool registry with `documentation_search`, `documentation_fetch`, `documentation_get_navigation`, `documentation_get_page`, `code_binding_search`, `code_binding_get`, `tokens_list`, `token_get`, `token_values_get`, `components_list`, `component_get`, `component_config_get`, `component_styles_get` and `component_variations_get`.
- [x] 4.2 Add typed input schema descriptors and argument parsing for every new tool.
- [x] 4.3 Map application results to stable JSON-compatible MCP result DTOs without leaking credentials or stack traces.
- [x] 4.4 Map validation and backend failures to `INVALID_ARGUMENT`, `INVALID_QUERY`, `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `PUBLICATION_NOT_FOUND`, `BACKEND_UNAVAILABLE` and `CONTEXT_NOT_FOUND`.
- [x] 4.5 Add MCP contract tests for `tools/list`, successful `tools/call`, invalid arguments, backend errors and read-only tool surface.

## 5. Documentation and verification

- [x] 5.1 Update CLI/MCP usage documentation with the new read-only MCP tools and clarify that token/component reads use authoritative model API.
- [x] 5.2 Run `cd frontend-kt && ./gradlew build`.
- [x] 5.3 Run the relevant backend/gateway checks for changed Kotlin services, including build, detekt, spotlessCheck and tests.
- [x] 5.4 Run `cd js && npm run build` after db-service API/OpenAPI changes.
- [x] 5.5 Validate the OpenSpec change with `openspec validate --changes add-mcp-design-system-read-tools`.

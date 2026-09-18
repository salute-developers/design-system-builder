# Authorized CLI and backend audit

The gateway's `/api/projects/{projectId}/...` locations call `/_auth_project` and forward trusted actor, role, project and scope headers. `AuthorizeProjectRequestUseCase` accepts both Bearer JWT and ProjectKey, resolves user membership for the requested project, and preserves project-key scopes. This establishes project membership, but write permission still belongs to the downstream route.

| CLI operation | Gateway route | Frontend credential port | Downstream finding |
| --- | --- | --- | --- |
| `status` | `GET /api/projects/{id}` and `GET /api/projects/{id}/ds/design-systems/{id}` | Typed `CredentialProvider` | Project membership at gateway; design-system ownership filtered in db-service. |
| `docs publish` | `POST /api/projects/{id}/documentation/bundles` | Key-only `ProjectApiKeyProvider` and `HttpDocsPublisher` | documentation-service already maps trusted user and key actors; user role `owner`/`maintainer`/`editor` may publish. |
| `theme fetch` | `GET /api/projects/{id}/ds/design-systems/{id}/tenants`, `/tokens`; `GET /api/projects/{id}/ds/palette`, `/ds/tenants/{id}/token-values` | Key-only `ProjectApiKeyProvider`, `RemoteThemeCommand`, `HttpRemoteThemeDataSource` | db-service checks key scopes in routes where installed; user membership is accepted by the current scope middleware. Read routes need ownership review. |
| `components push` | `POST /api/projects/{id}/ds/component-config/import` | Key-only `ProjectApiKeyProvider`, `ImportComponentsCommand`, `HttpComponentConfigRemoteSource` | db-service checks `components:write` for a scoped key and design-system project ownership. It does not currently check a Bearer user's project role before write. |
| `components fetch` | `POST /api/projects/{id}/ds/component-config/export` | Key-only `ProjectApiKeyProvider`, `ExportComponentsCommand`, `HttpComponentConfigRemoteSource` | db-service checks `components:read` for a scoped key and design-system project ownership. |
| `auth login/status/logout` | Identity token endpoints | User session flow | Not project-scoped; no project key expected. |

MCP read tools use typed credentials for documentation, tokens and components, but their context is still bound to the launcher's workspace. They share the same gateway route families above.

`project-publisher` is not currently called by an authorized CLI command in this change. Its `/jobs` Ktor routes do not inspect forwarded project role or project-key scopes; they must be hardened before any CLI command is added there. The current documentation-service upload route already has user role handling. The db-service component import route has a downstream write gap: a Bearer user with a read-only project role reaches the import handler. Backend changes are explicitly outside this change's scope; this gap requires a separate backend change before relying on Bearer authorization for component writes. No database schema change is needed here.

No affected Ktor route requires a Bearer compatibility change: gateway user membership and documentation upload role checks already support Bearer, while publisher routes are outside the current CLI route set. Existing project-key behavior in those Ktor routes remains unchanged.

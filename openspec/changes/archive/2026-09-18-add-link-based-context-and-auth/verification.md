# Verification

The change was validated with `openspec validate add-link-based-context-and-auth`.

| Scenario group | Verification |
| --- | --- |
| Link syntax, required version/platform, invalid links, explicit context priority | `DesignSystemLinkTest`, `RuntimeAdaptersTest` |
| Config compatibility and credential policy | `ProjectConfigStoreAndCodecTest`, `RuntimeAdaptersTest` |
| CLI headless session and project-key env, local Bearer commands | `DsBuilderCliTest`, feature use-case and HTTP adapter tests |
| MCP per-call A/B selection, missing and invalid context, structured auth errors | `DsBuilderMcpServerCoreTest` |
| JVM and macOS MCP stdio without workspace | `McpCliLauncherContractTest`; local macOS native subprocess initialize, tools/list, explicit link, CONTEXT_REQUIRED, EOF and SIGTERM smoke |
| Node MCP package and headless stdio | `:mcp-node:npmPackMcpNodeSmoke`, including explicit link and missing context calls |
| Frontend compilation, tests and style | `frontend-kt` `build`, `detekt`, `spotlessCheck`; `git diff --check` |

Existing CLI and feature tests cover key precedence, local paths, missing credentials, and backend refusal mapping. The db-service Bearer `component-config/import` role check is a known backend gap documented in `backend-audit.md`; no backend route was changed here.

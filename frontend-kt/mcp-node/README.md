# dsbuilder-mcp

Local stdio MCP launcher for DS Builder.

## Usage

```bash
dsbuilder-mcp serve --workspace /path/to/project --api-url https://api.example.com
dsbuilder-mcp auth status --api-url https://api.example.com
```

The server writes only MCP protocol messages to stdout while running `serve`.

## Read-only tools

- `design_system_get_context`, `project_get_status`
- `documentation_search`, `documentation_fetch`, `documentation_get_navigation`, `documentation_get_page`
- `code_binding_search`, `code_binding_get`
- `tokens_list`, `token_get`, `token_values_get`
- `components_list`, `component_get`, `component_config_get`, `component_styles_get`, `component_variations_get`

Documentation and code-binding tools read published documentation artifacts. Token and component tools read the
authoritative DS Builder model API through `/api/projects/{projectId}/ds/...`.

# dsbuilder-mcp

Local stdio MCP launcher for DS Builder.

## Usage

```bash
dsbuilder-mcp serve --workspace /path/to/project --api-url https://api.example.com
dsbuilder-mcp auth status --api-url https://api.example.com
```

The server writes only MCP protocol messages to stdout while running `serve`.

`--workspace` is optional. Every read tool accepts an optional `designSystem` argument:
`dsbuilder://projects/project-123/design-systems/ds-456?version=1.0.0&platform=compose`.
The link selects context for that call only, so one server can read different design systems
without changing its active state. An explicit link uses the saved user session (`dsbuilder-mcp
auth login`); without a link, the nearest `.sdds/config.json` selects the context and its
credential policy (`auto`, `user-session`, or `project-key-env`). The `auto` policy checks a
project key environment variable before the user session. The link contains no credential
and does not select the backend API URL.

When local `.sdds/config.json` is selected, both this launcher and `dsbuilder mcp serve` also read
`<project-root>/.env` beside `.sdds/`. For example, a local `.env` may contain:

```dotenv
DSB_DEV_API_KEY=example-project-key
DSBUILDER_API_URL=https://api.example.test
```

The key name comes from `credential.name` in `.sdds/config.json`. A launcher argument wins first,
then the server process environment, then the project `.env`, then a code default where available.
The file accepts `NAME=VALUE`, optional `export`, quotes, and comments; it does not execute shell
commands or expand variables. Keep `.env` local and readable only by its owner; it is ignored by Git.
An explicit `designSystem` link does not read the local project's `.env`.

## Read-only tools

- `design_system_get_context`, `project_get_status`
- `documentation_search`, `documentation_fetch`, `documentation_get_navigation`, `documentation_get_page`
- `code_binding_search`, `code_binding_get`
- `tokens_list`, `token_get`, `token_values_get`
- `components_list`, `component_get`, `component_config_get`, `component_styles_get`, `component_variations_get`

Documentation and code-binding tools read published documentation artifacts. Token and component tools read the
authoritative DS Builder model API through `/api/projects/{projectId}/ds/...`.

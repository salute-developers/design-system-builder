# dsbuilder-mcp

Local stdio MCP launcher for DS Builder.

## Usage

```bash
dsbuilder-mcp serve --workspace /path/to/project
dsbuilder-mcp auth status
```

The server writes only MCP protocol messages to stdout while running `serve`.

`--workspace` is optional. Every read tool accepts an optional `designSystem` argument:
`dsbuilder://projects/project-123/design-systems/ds-456?version=1.0.0&platform=compose`.
The `platform` query parameter is optional; omitting it does not choose a default platform.
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

The key name comes from `credential.name` in `.sdds/config.json`. The server process environment wins over the project `.env`, then a code default is used where available.
The file accepts `NAME=VALUE`, optional `export`, quotes, and comments; it does not execute shell
commands or expand variables. Keep `.env` local and readable only by its owner; it is ignored by Git.
An explicit `designSystem` link does not read the local project's `.env`.

## Read-only tools

- `design_system_get_context`, `project_get_status`
- `design_system_versions_list`, `design_system_version_get`, `design_system_changes_list`
- `tenants_list`, `token_groups_list`, `palette_get`
- `documentation_publications_list`, `documentation_search`, `documentation_fetch`, `documentation_get_navigation`, `documentation_get_page`
- `code_binding_search`, `code_binding_get`
- `tokens_list`, `token_get`, `token_values_get`
- `components_list`, `component_get`, `component_styles_get`, `component_variations_get`
- `component_properties_get`, `component_dependencies_get`, `component_configurations_list`, `component_config_get`, `component_tokens_get`

Documentation and code-binding tools read published documentation artifacts. Token and component tools read the
authoritative DS Builder model API through `/api/projects/{projectId}/ds/...`.

## Model and documentation reads

Both launchers expose the same 27 read-only tools. Discovery (`initialize`, `tools/list`) works without credentials;
model reads, including `design_system_get_context`, require the selected credential.

Versioned reads use an exact `major.minor.patch` or `draft`. An explicit `version` overrides the URI version;
when neither is present, the active draft is read. `component_get` returns current component metadata and does
not select a configuration or accept a version. `component_variations_get` requires `appearanceId` instead of
`componentId` and reads that configuration's ordered axes, declared values and defaults through the existing
appearance API. It never picks a default configuration or calls `/components/{id}/variations`.

List tools send `limit=50` by default (range 1..200), `cursor` and filters to the backend. Results contain
`context`, `items` and an optional `nextCursor`; callers must continue with the same filters and selection.
Changing page size is supported. Draft edits can change results between pages; publishing a new draft makes
an old draft cursor invalid. Use a publication for an unchanged model boundary. Missing or invalid required
read/page metadata is reported as `BACKEND_UNAVAILABLE`, never as a successful final page.

This changes the previous MCP list shape and appearance argument. HTTP clients omitting `limit/cursor` retain
full arrays, and CLI `theme fetch` and `components fetch` retain their full download formats.

`component_configurations_list` returns configuration IDs for a component. `component_config_get` now requires
`appearanceId` and accepts `selectedValueIds`; it returns the resolved properties for exactly that selection.
`component_tokens_get` requires a value from every axis and returns verified token IDs and usage paths. The
previous `component_config_get(componentId)` arguments are incompatible with this version.

Documentation reads can select an exact `publicationId`. Without one, supply an exact documentation `version`
and `platform` (or select them in the design-system link). `documentation_publications_list` discovers published
IDs, including republished versions. `documentation_search` accepts repeated `subjects` and returns a factual
publication ID in its context; pass that ID with the original query and subjects for later pages. If the old
publication is no longer available, start a new search. `code_binding_search` returns summaries; `code_binding_get`
accepts exact `appearanceNames`, `variationNames` and `detail`. `documentation_fetch` returns compact content.

Backend API URL is configured through `DSBUILDER_API_URL` only; the `--api-url` option is not supported.
For local development, set `export DSBUILDER_API_URL=http://localhost:8080` before CLI commands, and pass the same environment variable to the MCP process.

Browser authentication: run `dsbuilder-mcp auth login` on the same
machine as your system browser. Password arguments and terminal password prompts
are no longer supported. Repeat browser login once to replace legacy sessions.
CLI and MCP share refresh sessions; IDE sessions remain separate. `auth status`
reports local metadata only. For CI use a project key. `serve` and tools never
open a browser. HTTPS is required except for localhost and 127.0.0.1.

Браузерный вход завершается русской страницей результата DS Builder. После
сообщения «Вы успешно авторизованы. Можете закрыть вкладку.» сессия уже сохранена.
При отказе callback, обмена кода или сохранения показывается страница ошибки;
повторите `auth login` в терминале.

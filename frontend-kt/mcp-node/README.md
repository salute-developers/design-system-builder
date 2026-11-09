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
without changing its active state. An explicit link selects PAT from DSBUILDER_API_KEY, otherwise the saved user session (`dsbuilder-mcp
auth login`); without a link, the nearest `.sdds/config.json` selects the context and its
credential policy (`auto`, `user-session`, or `pat-env`). The `auto` policy checks a
PAT environment variable before the user session. The link contains no credential
and does not select the backend API URL.

When local `.sdds/config.json` is selected, both this launcher and `dsbuilder mcp serve` also read
`<project-root>/.env` beside `.sdds/`. For example, a local `.env` may contain:

```dotenv
DSB_DEV_API_KEY=example-personal-access-token
DSBUILDER_API_URL=https://api.example.test
```

The key name comes from `credential.name` in `.sdds/config.json`. The server process environment wins over the project `.env`, then a code default is used where available.
The file accepts `NAME=VALUE`, optional `export`, quotes, and comments; it does not execute shell
commands or expand variables. Keep `.env` local and readable only by its owner; it is ignored by Git.
An explicit `designSystem` link does not read the local project's `.env`.

## Read-only tools

- `projects_list`, `design_systems_list`
- `design_system_get_context`, `project_get_status`
- `design_system_versions_list`, `design_system_version_get`, `design_system_changes_list`
- `tenants_list`, `token_groups_list`, `palette_get`
- `documentation_publications_list`, `documentation_search`, `documentation_fetch`, `documentation_get_navigation`, `documentation_get_page`
- `code_binding_search`, `code_binding_get`
- `tokens_list`, `token_get`, `token_values_get`
- `components_list`, `component_get`, `component_styles_get`, `component_variations_get`
- `component_properties_get`, `component_dependencies_get`, `component_configurations_list`, `component_config_get`, `component_tokens_get`

Documentation and code-binding tools read published documentation artifacts. Token and component tools read the
authoritative DS Builder model API through `/api/projects/{projectId}/design-systems/{designSystemId}/...`.

## Editor tools

Editor calls use `/api/projects/{projectId}/design-systems/{designSystemId}/...` and require the backend
contract from `scope-design-system-routes` (#149). Integration and release depend on its implementation.
Both launchers register the same schemas without resolving credentials during `tools/list`.

- `token_edit_data_get`, `component_editor_get` read draft source data and subject revisions.
- `token_create`, `token_update`, `token_delete` edit one definition.
- `token_value_create`, `token_value_update`, `token_value_delete` edit one value.
- `color_token_create`, `color_token_values_update`, `color_token_move`, `color_token_delete` edit families.
- `size_token_value_update`, `typography_style_update` use specialized server editors.
- `token_group_create`, `token_group_update`, `token_group_delete` manage supported color groups.
- `component_configuration_create`, `component_configuration_duplicate`, `component_configuration_update`,
  `component_configuration_delete` manage configurations.
- `component_axis_create`, `component_axis_update`, `component_axis_delete`, `component_axes_reorder`
  manage axis declarations and roles.
- `component_axis_value_create`, `component_axis_value_update`, `component_axis_value_delete`,
  `component_axis_values_reorder` manage declared values.
- `component_property_set`, `component_property_reset`, `component_states_reorder` edit properties and state sets.

Each editor call accepts `designSystem` and `version`. An omitted version inherits the selected context.
An effective published version returns `READ_ONLY_VERSION`. Explicit `version: "draft"` selects the draft
of the same system. Every mutation requires a non-empty `idempotencyKey` and accepts `baseRevision` where
supported by the server. Reuse the original key, arguments and revisions when retrying after a lost response.
A conflict remains a conflict. Bearer authorization can refresh once after HTTP 401 with the same command.

For one value use `token_value_update` with `valueId` and `value`. Its token, tenant, platform and mode are
immutable. To prepare a family update, read `token_edit_data_get(tokenId, tenantId)` and select members by
`tokenId`. Preserve `sourceValue`, palette references, `paletteId` and `overridden` from the source data.
Each selected member must supply all six web/ios/android and light/dark pairs with explicit `baseRevision`.
The tool sends one family PUT and includes only the supplied members. Family and group operations also
require the server compatibility field `editRevision` from the source reads. General and subject revisions
serve different purposes.

```json
{
  "name": "component_axis_update",
  "arguments": {
    "axisId": "<axis declaration ID>",
    "displayName": null,
    "isRoot": true,
    "version": "draft",
    "idempotencyKey": "<stable operation key>",
    "baseRevision": 7
  }
}
```

An omitted patch field preserves its value. Explicit `null` resets nullable declaration fields according
to the server contract. `component_editor_get` exposes declaration `axisId`/`valueId` and referenced
`styleId`. Property scope uses `styleIds` and state names. An empty style scope selects base properties.
Axis and value order tools require complete ordered ID lists. Axis/value deletion exposes `confirmCascade`.
Configuration deletion retains server protections for default configurations and referenced resources.

Deleting a color family removes its values and bindings across themes. Deleting a color group cascades to
nested groups and tokens. Groups have two supported levels and `kind: "color"`. Shadow edits target existing
variants through point tools or `size_token_value_update`. Component states come from existing component
metadata, and property tools select, reset or reorder state sets.

Mutation results contain `context`, `data` and `mutation`. The latter records the original key, HTTP status,
available subject metadata and `metadataTruncated`. Truncated metadata triggers confirmation reads in the
same runtime. `confirmation.incomplete` records failed reads while preserving the confirmed write.
`OUTCOME_UNKNOWN` means the response was lost, with the original key available for an identical retry.
Backend errors retain their category and safe structured details, including the backend code and HTTP status.

## Choosing a project and design system

Without a workspace, call `projects_list`, ask the user to choose a project, then call
`design_systems_list` with its `projectId`. Ask the user to choose a system and pass both
`projectId` and `designSystemId` to `design_system_versions_list`. Published items include a
canonical `designSystem` URI with a version for subsequent reads. These discovery calls use
a PAT from the environment or the user session of the selected backend (`dsbuilder auth login`),
and do not write workspace files or store a global selection. Both IDs must be supplied together;
combining them with a URI is rejected. Existing URI/workspace calls continue to work.

## Model and documentation reads

Both launchers expose the same 61 tools, including 31 reads and 30 mutations. Discovery (`initialize`, `tools/list`) works without credentials;
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
read/page metadata is reported as `INVALID_BACKEND_RESPONSE`, never as a successful final page.
Connection failures and HTTP 5xx remain `BACKEND_UNAVAILABLE`.

This changes the previous MCP list shape and appearance argument. HTTP clients omitting `limit/cursor` retain
full arrays, and CLI `theme fetch` and `components fetch` retain their full download formats.

`component_configurations_list` returns configuration IDs for a component. `component_config_get` now requires
`appearanceId` and accepts `selectedValueIds`; it returns the resolved properties for exactly that selection.
`component_tokens_get` requires a value from every axis and returns verified token IDs and usage paths. The
previous `component_config_get(componentId)` arguments are incompatible with this version.
`component_properties_get` returns a compact property list by default (`id`, `name`, `type`, `defaultValue`);
pass `detail=full` to include platform parameters, descriptions and timestamps.

Documentation reads can select an exact `publicationId`. For navigation, pages and code bindings without one, supply
an exact documentation `version` and `platform` (or select them in the design-system link). `documentation_search`
without `version` searches the latest active publication for the selected platform, even when the link selects a
model version; if none exists, it reports that documentation has not been published.
`documentation_publications_list` discovers published
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
reports local metadata only. For CI use a PAT. `serve` and tools never
open a browser. HTTPS is required except for localhost and 127.0.0.1.

CLI and Node MCP use the same PID-owned session lock. Locks left by terminated
processes are recovered automatically. The `.lock` directory stays in place; its
`held` child is the actual lock. Update CLI and Node MCP together and restart
running clients; older clients cannot use this lock protocol.
An old empty `.json.lock` file has no owner information and is not removed
automatically: stop old CLI/MCP processes before removing that lock file and retrying.
Keep the adjacent `.json` session file.

Браузерный вход завершается русской страницей результата DS Builder. После
сообщения «Вы успешно авторизованы. Можете закрыть вкладку.» сессия уже сохранена.
При отказе callback, обмена кода или сохранения показывается страница ошибки;
повторите `auth login` в терминале.

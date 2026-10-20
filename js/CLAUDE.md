# Claude context — Design System Builder (js)

This file is auto-loaded at the start of every session. It exists so you can orient yourself instantly without having to re-derive the layout, ports, or conventions of the JavaScript part.

For a public-facing overview see [README.md](README.md). **This file is for things that are not obvious from the code** — conventions, gotchas, and rules that prior sessions established.

## At a glance

| Part | Path | Port (host) | Stack |
|---|---|---|---|
| Client | [apps/client](apps/client/) | 3002 | React 18 + Vite + `@salutejs/plasma-*` |
| CLI generator | [cli](cli/) | — | tsx, `@salutejs/plasma-new-hope` |

**Data flow:** `Client` → gateway (`http://localhost:8080`) → Kotlin `ds-service` (source of truth, [../backend-kt/ds-service](../backend-kt/ds-service/)). There is no Node.js service in `js/`: `db-service` was removed, its schema is owned by Flyway in `ds-service`. The npm package is generated locally by [cli](cli/) from `.sdds` data downloaded with `dsbuilder ds fetch`; the generator code lives in [cli/src/generator](cli/src/generator/).

## How to run things

**Recommended**: `../setup-local.sh` from the repository root — starts the Kotlin backend with its Postgres, fills the design system `base` through the gateway (`backend-kt/bootstrap-base.sh`) and starts the client from [docker-compose.dev.yml](docker-compose.dev.yml). Without Docker: `npm run dev` here (the client only) against a running gateway.

## Repository conventions

### Not a monorepo in the npm sense
- **No npm workspaces.** `apps/client` and `cli` have their own `node_modules` and `package.json`. Root `package.json` scripts are thin wrappers that `cd` into a package and call its own `npm run`. Don't "simplify" them into workspace commands.
- Root `npm run dev` / `npm run build` are only used for manual local dev. CI builds the client directly from `js/apps/client` (`working-directory`) and runs `cli` tests from `js/cli`.

### Tests
- `cli`: `npm run typecheck && npm test` in [cli](cli/) (`node:test`).
- `apps/client`: `npm test` (vitest). Tests that need a real component as an example use fixtures under `__fixtures__` (for example `modules/colorTokens/domain/__fixtures__/buttonSeed.ts`), never data from a service.

### Components and the global layer
- The global component layer (components, properties, platform names) comes from the web API meta: `npm run generate:api-meta -- --package @salutejs/plasma-new-hope` in [cli](cli/) writes `.sdds/web/web-api-meta.json`, `dsbuilder components import-api --platform react` loads it (system administrator only, served by `ds-service` under `POST /api/admin/component-config/import-api-meta`).
- A plasma component is added with `npm run import:plasma -- --component=<X>` in [cli](cli/) (writes the `.sdds/components` package and the generator manifest) and `dsbuilder components push --platform react --from .sdds/components --apply`. The rules and checks are in `.claude/skills/add-component/SKILL.md`.
- Web parameter templates of multi-value CSS properties live in the generator manifests `cli/src/generator/templates/<X>/component.json` (`webTemplates`), not in `ds-service`.

### Removed services — don't resurrect
These were deleted intentionally. If you see stale references to them in code/docs, clean them up — do not reintroduce them:
- `services/client-proxy`
- `apps/frontend` (replaced by `apps/client`)
- `generate-ds` (old CLI)
- `services/generator` (HTTP generation service; the generator code moved to `cli/src/generator`)
- `services/publisher` (npm publishing service)
- `services/documentation-generator` (Docusaurus documentation service; documentation now lives in Kotlin `documentation-service` and `dsbuilder docs`)
- `apps/admin` (registry inspector) together with the `/api/admin/tables|queries|schema` routes; the only `/api/admin/*` route left is `import-api-meta` in `ds-service`
- `services/db-service` (Express + Drizzle registry) together with its seeds, Drizzle migrations, `setup-docker.sh`, the `/ds/legacy` gateway route and the `/sync-*` skills; `ds-service` owns the schema (Flyway) and the data

### CI / deployment
- [production workflow](../.github/workflows/deploy-front-apps-prom.yml) — on push to `master`, builds `apps/client` and syncs it to S3.
- [deploy-front-apps-dev.yml](../.github/workflows/deploy-front-apps-dev.yml) — the same flow for the dev stand.
- [validate-js.yml](../.github/workflows/validate-js.yml) — ESLint, `cli` tests and the client build on PRs.

## Key files to remember

- [apps/client/src/api/componentRepository.ts](apps/client/src/api/componentRepository.ts) and [componentModelEnrichment.ts](apps/client/src/api/componentModelEnrichment.ts) — load the theme-editor component model from `ds-service` and fill web params, property variations, templates and dependencies
- [apps/client/src/api/designSystemImport.ts](apps/client/src/api/designSystemImport.ts) — design-system import through `ds-service`
- [cli/src/generator](cli/src/generator/) — theme and component generators, templates and manifests
- [cli/src/import-plasma-component.ts](cli/src/import-plasma-component.ts) — plasma component import
- [docker-compose.dev.yml](docker-compose.dev.yml) — the client container

## Communication

- User prefers responses in **Russian**.
- User prefers **concise, direct** answers. Don't pad with disclaimers or restate the question.
- When the user asks you to do something, do not ask for confirmation on each step — just proceed. Ask only when there's a genuine ambiguity that can't be resolved by reading the code.
- When a task is "clean up X" or "check for tails of Y", be thorough: grep the whole repo, check CI, Docker, docs, and package.json scripts.

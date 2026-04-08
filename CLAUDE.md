# Claude context — Design System Builder

This file is auto-loaded at the start of every session. It exists so you can orient yourself instantly without having to re-derive the repository layout, ports, or conventions.

For a public-facing overview see [README.md](README.md). **This file is for things that are not obvious from the code** — conventions, gotchas, and rules that prior sessions established.

## Services at a glance

| Service | Path | Port (host) | Stack |
|---|---|---|---|
| DS Registry | [services/ds-registry](services/ds-registry/) | 3008 | Express + Drizzle + Postgres |
| DS Generator | [services/ds-generator](services/ds-generator/) | 3005 | Fastify |
| Publisher | [services/publisher](services/publisher/) | 3007 | Express (plain JS) |
| Docs Generator | [services/ds-documentation-generator](services/ds-documentation-generator/) | 3006 | NestJS + Docusaurus |
| Client | [apps/client](apps/client/) | 3002 | React 18 + Vite + `@salutejs/plasma-*` |
| Admin | [apps/admin](apps/admin/) | 3004 | React 18 + Vite + OpenAPI-typed client |
| Postgres (ds-registry) | — | 5433 | postgres:16-alpine, DB `ds_registry` |

**Data flow (the important one):** `Client` → `DS Registry` (source of truth). Generation/docs is triggered from the client against `DS Generator` / `Docs Generator`, which both fetch DS data from `DS Registry`. `Publisher` is called by `DS Generator` to push the built package to npm. The `Admin` app talks to `DS Registry` directly through an OpenAPI-typed fetch client.

## How to run things

**Recommended**: `./setup-docker.sh` — one-shot dev setup via [docker-compose.dev.yml](docker-compose.dev.yml). Brings up the full stack, runs migrations, seeds dev data, prints a health summary.

Without Docker: `npm run dev` from the repo root. Use the granular `dev:*` scripts in the root [package.json](package.json) to start individual services. These scripts are **only** used for manual local dev — CI, Docker, and hooks don't touch them.

## Repository conventions

### Not a monorepo in the npm sense
- **No npm workspaces.** Each app and service has its own `node_modules` and its own `package.json`. That's why `install:all` exists — it just walks every directory.
- Root `package.json` scripts are thin wrappers that `cd` into each package and call its own `npm run`. Don't "simplify" them into workspace commands.

### Source of truth for the DB schema
- **[services/ds-registry/src/db/schema.ts](services/ds-registry/src/db/schema.ts)** is the single source of truth.
- [docs/db-schema.dbml](docs/db-schema.dbml) is a hand-maintained mirror for visualization. If you change `schema.ts`, update the DBML to match. If they disagree, trust `schema.ts`.
- Enums are declared as Postgres `pgEnum`s, not as text + CHECK. Don't recommend adding CHECKs for things already covered by an enum.

### Sync rules — VERY IMPORTANT
Whenever you touch certain files in `ds-registry`, generated artifacts must be regenerated via the `/sync-*` skills. These skills exist specifically for this and you should use them proactively — do not hand-edit the generated files.

- **After editing [services/ds-registry/src/db/schema.ts](services/ds-registry/src/db/schema.ts)** (add/remove tables or columns):
  1. Run `npm run db:generate` in `services/ds-registry` to create a SQL migration.
  2. Run `/sync-all` — it updates `validation/schema.ts`, `routes/api/*`, `openapi/spec.ts`, and regenerates `apps/admin/src/api/{openapi.json,types.gen.ts}`.
- **After editing files under [services/ds-registry/src/routes/api/](services/ds-registry/src/routes/api/)** (adding/removing routes): run `/sync-spec` and `/sync-api-types` (or just `/sync-all`).
- **Batch first, sync last.** If you're making a series of related edits to schema/routes, finish them all before running `/sync-all` — don't regenerate after each individual edit, it's wasteful.
- The individual skills (`/sync-validation`, `/sync-routes`, `/sync-spec`, `/sync-api-types`) exist for when you know exactly what needs syncing. `/sync-all` runs them in the correct order.

### Scripts that look important but aren't
- Root `npm run dev` / `npm run build` / `install:all` — only used for manual local dev. CI builds apps directly via `npm run build --prefix="./apps/<name>"` and doesn't touch root scripts.

### Removed services — don't resurrect
These were deleted intentionally. If you see stale references to them in code/docs, clean them up — do not reintroduce them:
- `services/db-service`
- `services/client-proxy`
- `apps/frontend` (replaced by `apps/client` and `apps/admin`)
- `generate-ds` (old CLI, superseded by `services/ds-generator`)

### Admin app gotchas
- **`/nl-query` page does not exist.** NL-query functionality is implemented as a `NLQueryContent` component **inside** [apps/admin/src/pages/QueriesPage.tsx](apps/admin/src/pages/QueriesPage.tsx) and rendered as a tab in the `/queries` sidebar. A standalone `NLQueryPage.tsx` used to exist but was deleted as dead code. Don't recreate it.
- Admin pages registered in [apps/admin/src/App.tsx](apps/admin/src/App.tsx): `/tables`, `/queries`, `/schema`, `/docs`, `/settings`. That's all of them.
- The admin API client is **OpenAPI-typed**. When adding new routes to `ds-registry`, run `/sync-api-types` so `apps/admin/src/api/types.gen.ts` stays in sync.
- NL-query backend endpoint `/api/nl-query` is still used by `QueriesPage` (`NLQueryContent`) — don't remove the backend route.

### CI / deployment
- [.github/workflows/design-system-builder.yml](.github/workflows/design-system-builder.yml) — on push to `master`, builds `apps/client` + `apps/admin` and syncs them to S3.
- [.github/workflows/design-system-builder-pr.yml](.github/workflows/design-system-builder-pr.yml) — same for PRs.
- **Backend services are NOT deployed from this repo.** `ds-registry`, `ds-generator`, `publisher`, `ds-documentation-generator` have their own deployment elsewhere.

## Key files to remember

- [services/ds-registry/src/db/schema.ts](services/ds-registry/src/db/schema.ts) — DB schema (source of truth)
- [services/ds-registry/src/routes/api/](services/ds-registry/src/routes/api/) — CRUD routes (one file per table)
- [services/ds-registry/src/routes/misc/](services/ds-registry/src/routes/misc/) — tables/queries/nl-query/schema auxiliary routes
- [services/ds-registry/src/openapi/spec.ts](services/ds-registry/src/openapi/spec.ts) — OpenAPI spec (generated via `/sync-spec`)
- [services/ds-registry/src/validation/schema.ts](services/ds-registry/src/validation/schema.ts) — Zod validators (generated via `/sync-validation`)
- [apps/admin/src/api/types.gen.ts](apps/admin/src/api/types.gen.ts) — admin's API types (generated via `/sync-api-types`)
- [docker-compose.dev.yml](docker-compose.dev.yml) — full dev stack
- [setup-docker.sh](setup-docker.sh) — one-shot dev setup
- [docs/db-schema.dbml](docs/db-schema.dbml) — DBML mirror of the DB schema (hand-maintained)

## Communication

- User prefers responses in **Russian**.
- User prefers **concise, direct** answers. Don't pad with disclaimers or restate the question.
- When the user asks you to do something, do not ask for confirmation on each step — just proceed. Ask only when there's a genuine ambiguity that can't be resolved by reading the code.
- When a task is "clean up X" or "check for tails of Y", be thorough: grep the whole repo, check CI, Docker, docs, and package.json scripts.

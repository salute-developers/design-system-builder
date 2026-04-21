# Design System Builder

A web platform for building, managing, and publishing design systems end-to-end.

Design System Builder lets product teams compose their own design system from a shared component catalog, customize tokens (colors, typography, spacing, etc.), preview the result in real time, and then **generate, publish, and document** the resulting npm package — all from a single UI.

It is the tooling layer behind several Salute design systems built on top of [@salutejs/plasma](https://github.com/salute-developers/plasma).

## What you can do with it

- **Compose a design system** from a shared catalog of components and variations
- **Tweak tokens** (colors, typography, spacing, shape, etc.) with live preview
- **Generate** a ready-to-use npm package from your configuration
- **Publish** that package to a private npm registry in one click
- **Generate documentation** (Docusaurus site) and deploy it to S3
- **Inspect and query** the underlying registry through an admin panel (tables, schema, OpenAPI, NL queries)

## Architecture

The platform is a small set of independent services around a central registry. All services are deployed and orchestrated through Docker Compose.

```
                       ┌────────────────────┐
                       │       Admin        │  React SPA — registry inspector,
                       │   apps/admin :3004 │  schema browser, OpenAPI, NL queries
                       └─────────┬──────────┘
                                 │ REST (OpenAPI-typed)
                                 ▼
┌────────────────────┐  REST   ┌────────────────────┐    ┌──────────────────┐
│       Client       │ ──────▶ │     DB Service     │◀──▶│  PostgreSQL      │
│  apps/client :3002 │         │   db-service :3008 │    │  (postgres-      │
│  (DS builder UI)   │         │  Express + Drizzle │    │   registry :5433)│
└─────┬───────┬──────┘         └─────────┬──────────┘    └──────────────────┘
      │       │                          ▲
      │       │                          │ fetch DS data
      │       │                          │
      │       │                ┌─────────┴──────────┐    ┌────────────���─────┐
      │       └──────REST─────▶│      Generator     │───▶│    Publisher     │
      │                        │    generator :3005 │    │  publisher :3007 │
      │                        │  Fastify + CLI     │    │  npm publish     │
      │                        └────────────────────┘    └──────────────────┘
      │
      │                        ┌────────────────────┐    ┌──────────────────┐
      └─────────REST──────────▶│  Docs Generator    │───▶│      AWS S3      │
                               │ docs-generator:3006│    │  (docs hosting)  │
                               │  NestJS+Docusaurus │    │                  │
                               └─────────┬──────────┘    └──────────────────┘
                                         │ fetch DS data
                                         ▼
                                  (DB Service)
```

### Services

| Service | Path | Port | Stack | Purpose |
|---|---|---|---|---|
| **DB Service** | [services/db-service](services/db-service/) | 3008 | Express, Drizzle ORM, Postgres, Zod, OpenAPI | Source of truth. Stores design systems, components, variations, tokens. Exposes a typed REST API and an auto-generated OpenAPI spec. |
| **Generator** | [services/generator](services/generator/) | 3005 | Fastify | Builds an npm package from a design system stored in the registry. Available both as a web service and as a CLI (`plasma-ds-generate`). |
| **Publisher** | [services/publisher](services/publisher/) | 3007 | Express | Receives a packaged design system from the generator and publishes it to a configured npm registry. |
| **Docs Generator** | [services/documentation-generator](services/documentation-generator/) | 3006 | NestJS, Handlebars, Docusaurus | Pulls a design system from the registry, renders a Docusaurus project from templates, builds the static site, and uploads it to S3. |
| **Client** | [apps/client](apps/client/) | 3002 | React 18, Vite, `@salutejs/plasma-*` | The end-user UI for composing a design system, editing tokens, and triggering generation/publication/documentation. |
| **Admin** | [apps/admin](apps/admin/) | 3004 | React 18, Vite, OpenAPI types | Inspector for the registry: schema view, table browser, OpenAPI reference, saved/NL queries. |

### How a design system flows through the system

1. **Authoring.** A user opens the **Client** ([apps/client](apps/client/)) and composes a design system — picks components, edits tokens, previews the result. The client persists everything to the **DB Service** over REST.
2. **Generation.** From the same UI the user triggers `generate-download` or `generate-publish` on the **Generator**. The generator fetches the design system from the registry, builds an npm package, and either streams it back to the client or hands it off to the **Publisher**.
3. **Publication.** The **Publisher** receives the tarball and pushes it to a configured npm registry, making the design system installable as `@salutejs-ds/<name>`.
4. **Documentation.** The user (still from the client UI) triggers `documentation/generate` on the **Docs Generator**. It fetches the design system from the registry, renders a Docusaurus project from Handlebars templates, builds the static site, and uploads the result to **S3**.
5. **Inspection.** The **Admin** app talks to the registry directly through its OpenAPI-typed client, used for debugging schema, browsing tables, and running ad-hoc queries.

## Repository layout

```
design-system-builder/
├── apps/
│   ├── admin/                          # React admin (registry inspector)
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── client.ts           # typed API client (openapi-fetch)
│   │   │   │   ├── openapi.json        # generated OpenAPI spec (artifact)
│   │   │   │   └── types.gen.ts        # generated TS types (artifact)
│   │   │   ├── pages/
│   │   │   │   ├── TablesPage.tsx      # /tables — DB table browser
│   │   │   │   ├── QueriesPage.tsx     # /queries — saved query catalog
│   │   │   │   ├── SchemaPage.tsx      # /schema — ER diagram
│   │   │   │   ├── DocsPage.tsx        # /docs — Scalar API reference
│   │   │   │   └── SettingsPage.tsx    # /settings
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── client/                         # React DS builder UI (Plasma-based)
│       ├── src/
│       ├── vite.config.ts
│       └── package.json
├── services/
│   ├── db-service/                     # Express + Drizzle, central registry API
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── index.ts            # DB connection (postgres-js + Drizzle)
│   │   │   │   ├── schema.ts           # Drizzle schema
│   │   │   │   ├── seed-dev.ts         # dev seeding entry point
│   │   │   │   ├── seed-prod.ts        # prod seeding entry point
│   │   │   │   ├── reset.ts            # full schema reset
│   │   │   │   ├── clear.ts            # truncate tables
│   │   │   │   └── seeds/              # per-table seed files (data/dev/prod)
│   │   │   ├── routes/
│   │   │   │   ├── index.ts            # root router
│   │   │   │   ├── api/                # CRUD routes (one file per resource)
│   │   │   │   │   ├── utils.ts        # assertFound, tryCatch
│   │   │   │   │   ├── design-systems.ts
│   │   │   │   │   ├── components.ts
│   │   │   │   │   ├── tokens.ts
│   │   │   │   │   ├── legacy.ts       # /api/legacy/design-systems/:name/*
│   │   │   │   │   └── …               # the rest of the resources
│   │   │   │   └── misc/               # auxiliary routes
│   │   │   │       ├── tables.ts       # /api/tables
│   │   │   │       ├── queries.ts      # /api/queries
│   │   │   │       ├── nl-query.ts     # /api/nl-query
│   │   │   │       └── schema.ts       # /api/schema
│   │   │   ├── validation/
│   │   │   │   ├── schema.ts           # Zod schemas for all tables
│   │   │   │   └── middleware.ts       # validateBody, validateParams
│   │   │   ├── openapi/
│   │   │   │   ├── spec.ts             # OpenAPI 3 spec (auto-built from Drizzle + Zod)
│   │   │   │   └── generate.ts         # writes openapi.json
│   │   │   ├── queries/
│   │   │   │   └── catalog.ts          # named query catalog
│   │   │   ├── nl-query/
│   │   │   │   ├── llm-service.ts      # Z.AI API client
│   │   │   │   ├── schema-context.ts   # schema context for the LLM
│   │   │   │   └── sql-validator.ts    # validation (SELECT only)
│   │   │   ├── zod-extend.ts           # extendZodWithOpenApi (called once)
│   │   │   └── index.ts                # Express server entry
│   │   ├── drizzle/                    # generated SQL migrations
│   │   ├── drizzle.config.ts
│   │   ├── .env.example
│   │   └── package.json
│   ├── generator/                      # Fastify, builds DS npm packages
│   ├── documentation-generator/        # NestJS, builds Docusaurus + S3 deploy
│   └── publisher/                      # Express, npm publishing
├── docs/                               # Internal docs (schema, status, todo)
├── .github/
│   ├── workflows/                      # CI: build & deploy apps to S3
│   └── actions/
├── .claude/
│   └── skills/                         # Claude Code skills
│       ├── sync-all/                   # /sync-all — full sync
│       ├── sync-validation/            # /sync-validation — refresh Zod schemas
│       ├── sync-routes/                # /sync-routes — create/remove routes
│       ├── sync-spec/                  # /sync-spec — refresh OpenAPI spec
│       └── sync-api-types/             # /sync-api-types — regenerate TS types
├── docker-compose.yml                  # Production compose (subset)
├── docker-compose.dev.yml              # Development compose (full stack)
├── setup-docker.sh                     # One-command dev setup
└── package.json                        # Root scripts (dev / build / install:all)
```

## Quick start

> **Recommended path: Docker.** It is the only setup that's actively used and tested. Local (non-Docker) development still works for individual services but you have to wire ports and env vars yourself.

### Prerequisites

- Docker and Docker Compose
- Node.js ≥ 18 (only if you want to run services outside of Docker)

### Run everything with Docker (recommended)

```bash
# Clone
git clone <repo-url>
cd design-system-builder

# Start everything (postgres + db-service + admin + client + generator + publisher + docs-generator)
./setup-docker.sh
```

The script builds the dev images, starts the stack via [docker-compose.dev.yml](docker-compose.dev.yml), runs the registry migrations, seeds dev data, and prints a health summary.

Once it's done:

| Service | URL |
|---|---|
| Client (DS builder UI) | http://localhost:3002 |
| Admin (registry inspector) | http://localhost:3004 |
| DB Service API | http://localhost:3008/api |
| Generator | http://localhost:3005 |
| Docs Generator | http://localhost:3006 |
| Publisher | http://localhost:3007 |
| Postgres (db-service) | localhost:5433 |

Common commands:

```bash
# Logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop (data persists)
docker-compose -f docker-compose.dev.yml down

# Stop and wipe data
docker-compose -f docker-compose.dev.yml down -v

# Re-run migrations / re-seed manually
docker-compose -f docker-compose.dev.yml exec db-service npx drizzle-kit migrate
docker-compose -f docker-compose.dev.yml exec db-service npx tsx src/db/seed-dev.ts
```

### Run locally without Docker

You'll need a Postgres instance reachable from `db-service` and the right env vars in each service.

```bash
# 1. Start Postgres (you can still use the dev compose for the DB only)
docker-compose -f docker-compose.dev.yml up -d postgres-registry

# 2. Configure db-service
cp services/db-service/.env.example services/db-service/.env
# default values already point at localhost:5433/ds_registry

# 3. Install dependencies for every workspace
npm run install:all

# 4. Apply migrations and seed
cd services/db-service
npm run db:migrate
npm run db:seed:dev
cd ../..

# 5. Start everything in parallel
npm run dev
```

The root [package.json](package.json) exposes per-service scripts so you can also start them one by one:

| Script | What it runs |
|---|---|
| `npm run dev` | All services and apps in parallel |
| `npm run dev:services` | Backend services only (db-service, generator, publisher, documentation-generator) |
| `npm run dev:db-service` | DB Service only (port 3008) |
| `npm run dev:generator` | Generator only (port 3005) |
| `npm run dev:publisher` | Publisher only (port 3007) |
| `npm run dev:documentation-generator` | Docs Generator only (port 3006) |
| `npm run dev:client` | Client app only (port 3002) |
| `npm run dev:admin` | Admin app only (port 3004) |
| `npm run build` | Production build of every service and app |
| `npm run install:all` | Install dependencies in every workspace |

## DB Service: database

Postgres lives in the dev compose as `postgres-registry` (host port `5433`). The registry connects with:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ds_registry
PORT=3008
ZAI_API_KEY=your-zai-api-key-here   # for /api/nl-query
```

Inside Docker the host becomes `postgres-registry:5432`. See [services/db-service/.env.example](services/db-service/.env.example).

### Drizzle ORM commands

Run from `services/db-service`:

| Command | Description |
|---|---|
| `npm run db:generate` | Generate a SQL migration after changing `schema.ts` |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:seed:dev` | Seed the DB with dev fixtures |
| `npm run db:seed:prod` | Seed the DB with prod fixtures |
| `npm run db:reset` | Drop the schema (run migrate + seed afterwards) |
| `npm run db:clear` | Truncate tables (keeps the schema) |
| `npm run db:studio` | Open Drizzle Studio |

### Common scenarios

**First run (without Docker):**
```bash
docker-compose -f docker-compose.dev.yml up -d postgres-registry
cd services/db-service
npm run db:migrate
npm run db:seed:dev
```

**Schema (`schema.ts`) or routes (`routes/api/`) changed:**
```bash
# Inside services/db-service
npm run db:generate   # only if schema.ts changed
npm run db:migrate    # only if schema.ts changed

# From the repo root, via Claude Code
/sync-all             # updates validation, routes, openapi spec, and admin types
```

**Reset to a clean state:**
```bash
cd services/db-service
npm run db:reset
npm run db:migrate
npm run db:seed:dev
```

## Admin: API types

The admin app uses a typed OpenAPI client. Types are generated from the registry's OpenAPI spec — no running backend required:

```bash
# Inside apps/admin
npm run api:gen        # uses the spec checked into apps/admin/src/api/openapi.json
npm run api:gen:live   # fetches it from http://localhost:3008/api/openapi.json
```

After regeneration the typed client in [apps/admin/src/api/client.ts](apps/admin/src/api/client.ts) is good to use:

```typescript
import { api } from "../api/client";

const { data } = await api.GET("/users");
const { data: user } = await api.GET("/users/{id}", {
  params: { path: { id: "..." } },
});
```

Run this after any schema/route changes — or just use `/sync-all`, which does it for you.

## Admin: pages

| Route | Description |
|---|---|
| `/tables` | Browse all DB tables, paginated |
| `/queries` | Saved query catalog with parameters |
| `/schema` | Interactive ER diagram |
| `/docs` | Scalar API reference (OpenAPI) |
| `/settings` | Admin settings |

## Claude Code skills

Skills for keeping the registry's generated artifacts in sync with the schema and routes. Live in [.claude/skills/](.claude/skills/).

| Skill | What it does |
|---|---|
| `/sync-all` | Runs the four skills below in order |
| `/sync-validation` | Updates `services/db-service/src/validation/schema.ts` |
| `/sync-routes` | Creates/removes files in `services/db-service/src/routes/api/`, updates `routes/index.ts` |
| `/sync-spec` | Updates `services/db-service/src/openapi/spec.ts` |
| `/sync-api-types` | Regenerates `apps/admin/src/api/openapi.json` and `types.gen.ts` |

## CI / Deployment

GitHub Actions in [.github/workflows/](.github/workflows/) build the two frontend apps and sync them to S3:

- [design-system-builder.yml](.github/workflows/design-system-builder.yml) — runs on `master`, builds `apps/client` and `apps/admin` and uploads the dists to the production S3 bucket.
- [design-system-builder-pr.yml](.github/workflows/design-system-builder-pr.yml) — same flow for pull requests.

Backend services (`db-service`, `generator`, `publisher`, `documentation-generator`) are deployed separately from this repo's CI.

## Documentation

- [docs/database-schema.md](docs/database-schema.md) — registry database schema
- [docs/component creation.md](docs/database-schema.md) — how to create a component
- [services/documentation-generator/README.md](services/documentation-generator/README.md) — docs-generator deep-dive

## License

See repository for license information.

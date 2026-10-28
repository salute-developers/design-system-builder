# Design System Builder — JavaScript part

`js/` holds the React client of DS Builder and the local generator of the React design-system package. The data lives in the Kotlin `ds-service` ([backend-kt](../backend-kt/)) behind the gateway; there is no Node.js service any more.

## What is here

| Part | Path | Port | Stack | Purpose |
|---|---|---|---|---|
| **Client** | [apps/client](apps/client/) | 3002 | React 18, Vite, `@salutejs/plasma-*` | The UI for composing a design system, editing tokens and previewing components. Talks to the gateway (`VITE_API_GATEWAY_URL`). |
| **CLI generator** | [cli](cli/) | — | tsx, `@salutejs/plasma-new-hope` | Generates the npm package of a design system from local `.sdds` data (`npm run generate:ds`), imports plasma components (`npm run import:plasma`), builds the web API meta (`npm run generate:api-meta`). `dsbuilder` runs the same scripts for the React platform. |

### How a design system flows through the system

1. **Authoring.** A user opens the **Client** and composes a design system — picks components, edits tokens, previews the result. The client reads and writes everything through the gateway into `ds-service`.
2. **Generation.** `dsbuilder ds fetch` downloads the theme and the component configurations into `.sdds`, and [cli](cli/) generates the npm package from them (`generate:theme`, `generate:components`, `generate:ds`).
3. **New components.** `npm run import:plasma` in [cli](cli/) turns a plasma component into a `.sdds/components` package, `dsbuilder components push --platform react` loads it into `ds-service`. The full procedure is in [docs/component-creation.md](docs/component-creation.md) and the `add-component` skill.

## Repository layout

```
js/
├── apps/
│   └── client/                 # React DS builder UI (Plasma-based)
├── cli/                        # Local generator, plasma import, web API meta
│   ├── src/generator/          # Theme and component generators, templates and manifests
│   ├── src/import-plasma-component.ts
│   └── README.md
├── docs/                       # component-creation.md
├── docker-compose.dev.yml      # Development compose: the client only
└── package.json                # Root scripts (dev / build / test:cli / verify:*)
```

## Quick start

The whole local contour (gateway, Keycloak, `ds-service` with its Postgres, documentation service and the client) is started from the repository root:

```bash
../setup-local.sh
```

It fills the design system `base` through the gateway and starts the client from [docker-compose.dev.yml](docker-compose.dev.yml). Details are in the root [README.md](../README.md).

Once it's done:

| Service | URL |
|---|---|
| Client (DS builder UI) | http://localhost:3002 |
| API gateway | http://localhost:8080 |
| Postgres of `ds-service` | localhost:5433 (`ds_registry`) |

### Run the client without Docker

```bash
cd apps/client
npm ci
npm run dev
```

The client needs the gateway at `VITE_API_GATEWAY_URL` (default `http://localhost:8080`, see [apps/client](apps/client/)). The root [package.json](package.json) scripts:

| Script | What it runs |
|---|---|
| `npm run dev` | Client dev server (port 3002 in Docker, 5173 locally) |
| `npm run build` | Production build of the client |
| `npm run test:cli` | Typecheck and tests of [cli](cli/) |
| `npm run verify:fast` | Build plus CLI tests (used by `tools/verify`) |

There is no npm workspace: every app carries its own `package.json` and `node_modules`.

## CI / Deployment

GitHub Actions in [.github/workflows/](../.github/workflows/) build the client app and sync it to S3:

- [deploy-front-apps-prom.yml](../.github/workflows/deploy-front-apps-prom.yml) — runs on `master`, builds `apps/client` and uploads the dist to the production S3 bucket.
- [deploy-front-apps-dev.yml](../.github/workflows/deploy-front-apps-dev.yml) — the same flow for the dev stand.
- [validate-js.yml](../.github/workflows/validate-js.yml) — lint, CLI tests and the client build on pull requests.

## Documentation

- [docs/component-creation.md](docs/component-creation.md) — how to add a plasma component
- [cli/README.md](cli/README.md) — local generation and plasma import

## License

See repository for license information.

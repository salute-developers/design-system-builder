# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Переменные окружения

| Переменная | Значения | По умолчанию | Назначение |
|---|---|---|---|
| `VITE_API_GATEWAY_URL` | URL | `''` | Адрес API gateway |
| `VITE_CLIENT_ID` | строка | — | OIDC client id |
| `VITE_PALETTE_SOURCE` | `api` \| `local` | `api` | Источник палитры темы: `api` работает с `ds-service` (`/api/projects/{p}/ds/tenants/{t}/palette`), `local` хранит её в `localStorage` браузера (для разработки без сервера) |

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
# DS Builder client

## Feature flags

The component editor section ("Компоненты") is switched at build time by `VITE_COMPONENT_EDITOR_ENABLED`:

| Value | Result |
| --- | --- |
| `true` | the section is available |
| any other value | the section is off |
| not set | on in the dev server (`npm run dev`), off in a production build |

When the section is off, the navigation button is not shown, `.../components[/<name>]` redirects to `colors`, and the client
does not request component configs. The other editors work as usual.

DEV (`deploy-front-apps-dev.yml`) builds with `true`, PROM (`deploy-front-apps-prom.yml`) with `false`.
`js/docker-compose.dev.yml` defaults to `true`; override it with `VITE_COMPONENT_EDITOR_ENABLED=false` in the
environment. To turn the section off in the local dev server, set the variable in `.env.local`.

## Compose preview plugin

Compose preview is an optional pilot renderer for the `Button` component. The plugin is **not part
of the client build and is not linked with it**. The client loads it at runtime, in an `iframe`,
from the URL set in `VITE_COMPOSE_PREVIEW_PLUGIN_URL`, and the two communicate only through
`postMessage` and the Preview Protocol. The plugin is built in `plasma-android` and hosted
separately; do not copy it into `public` or commit the archive to Git.

Without `VITE_COMPOSE_PREVIEW_PLUGIN_URL` the client behaves exactly as before: Compose preview is
not offered anywhere. There is no default URL in the client code.

### Build the plugin

In the `plasma-android` repository:

```sh
./gradlew -p integration-core :preview-compose-plugin:previewPluginArtifact
```

The archive is created at
`integration-core/preview-compose-plugin/build/distributions/preview-compose-plugin.zip`. It
contains the HTML shell, `preview-plugin.json` (the manifest), JavaScript and the Wasm binaries.

### Serve it locally

```sh
COMPOSE_PREVIEW_PLUGIN_ARTIFACT=/path/to/preview-compose-plugin.zip npm run dev:compose-plugin
```

The command serves the archive (or an unpacked directory) at `http://127.0.0.1:8081/` with CORS
enabled and `Content-Type: application/wasm` for `.wasm` files. To use another archive or port:

```sh
node scripts/serve-compose-plugin.mjs /path/to/preview-compose-plugin.zip 8081
```

Then create `.env.local` (it is not committed) and set:

```text
VITE_COMPOSE_PREVIEW_PLUGIN_URL=http://127.0.0.1:8081/
```

Start the client with `npm run dev`. The component editor offers `React / Compose` only for
`Button`, and only when the URL is configured and the plugin manifest is compatible. An
unavailable or incompatible plugin reports a failure inside the Compose viewport while React mode
remains available.

### Hosting requirements

Any static host works. It must:

- serve `.wasm` files with `Content-Type: application/wasm`;
- serve `preview-plugin.json` and the entry point from the root of the URL you configure;
- allow the entry point to be loaded in an `iframe` of the client page (no blocking
  `X-Frame-Options` or `frame-ancestors`);
- make every resource the plugin requests over the network reachable, for example fonts from
  token values (CORS applies).

The `iframe` is created with `sandbox="allow-scripts allow-same-origin"` and the session checks
`event.source` and `event.origin` of every reply.

### Browser support

The plugin is a Kotlin/Wasm application, so the browser must support WebAssembly GC and WebAssembly
exception handling. The client checks this with `WebAssembly.validate` before loading the plugin
(`src/composePreview/environment.ts`). When the check fails the plugin is not loaded, a notice
explains that Compose preview is unavailable, and React preview stays available.

The exception-handling probe checks the legacy `try`/`catch_all` form that Kotlin 2.1 emits. If the
plugin is rebuilt with a Kotlin version that emits `exnref`, update the probe in `environment.ts`.

The plugin entrypoint in `preview-plugin.json` must be served from the same origin as the manifest;
the client rejects a manifest whose entrypoint points elsewhere. The plugin has 30 seconds to report
`ready` (the unpacked bundle is about 12 MB, about 4 MB compressed).

### Security

If the plugin is served from the **same origin as the client**, that sandbox does not isolate it:
the plugin code can read the client's `localStorage`, where the access and refresh tokens live.
Serve the plugin from a separate origin. The local server above already does (another port).

Only a plugin built by the SDDS team from `plasma-android` is supported. Loading plugins from other
sources, including user-provided ones, is not supported.

### Cross-origin browser smoke

Install the Playwright browser once with `npx playwright install chromium` and run:

```sh
COMPOSE_PREVIEW_PLUGIN_ARTIFACT=/path/to/preview-compose-plugin.zip npm run test:browser-smoke
```

The smoke harness uses the React `ComposePreviewFrame`, waits for manifest → ready → payload →
success, sends a changed full canonical `BasicButton` payload, and verifies the same iframe
instance reports a second success.

### Preview Protocol schema

The schema in `src/composePreview/schema` is a synchronized consumer snapshot. Its canonical
source is `backend-kt/preview/contract/schemas/v1`. Shared fixtures from
`backend-kt/preview/contract/fixtures/v1/{valid,invalid}` are copied to `schema/fixtures`; the
schema test validates every `valid` fixture as accepted and every `invalid` one as rejected.
`check:preview-schema` compares schema and fixtures byte for byte, `sync:preview-schema` restores
the copies:

```sh
npm run sync:preview-schema
npm run check:preview-schema
```

### PoC boundary

The smoke harness uses a versioned canonical fixture, while the component editor assembles its
payload from the current `Config`, `Theme`, variation/style selections and story descriptor.
Backend changes, deployment of the plugin to DEV/PROD, plugin publication/catalog/signatures, and
components without explicit `Meta.preview.compose` metadata remain out of scope.

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
| `VITE_WEB_PREVIEW_PLUGIN_URL` | URL | не задан | Прямой адрес web-плагина превью для разработки самого плагина; без него адрес активного web-билда приходит от бэкенда. См. [Web preview plugin](#web-preview-plugin) |

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

## Иконки и картинки

- Новую иконку бери из пакета [`@salutejs/sdds-icons`](https://www.npmjs.com/package/@salutejs/sdds-icons)
  (`import { HistoryOutline } from '@salutejs/sdds-icons/16'`), а не добавляй SVG или другой файл.
- Перед заменой сверь иконку из пакета с макетом: форма, размер и вариант (`Outline`, `Fill`, `OutlineBold`)
  должны совпадать. Если иконка отличается или её нет в пакете, обратись к дизайнеру, не подбирай похожую сам.
- Картинки, которых нет в пакете (иллюстрации, заглушки), клади в `src/assets` и подключай через `import`.
  Не ссылайся на них путём от корня (`src="/catalog/..."`): на стендах клиент открывается по подпути `BASE_URL`,
  и такие картинки не загрузятся.
- Иконки в `src/assets/catalog/icons` добавлены до этого правила. Пять из них есть в `sdds-icons`
  (`HistoryOutline`, `PlusOutline`, `TypographyOutline`, `ShapeOutline`, `FileStackOutline`), но пока не заменены.

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

Compose preview renders Compose components with a Kotlin/Wasm plugin. The plugin is **not part of
the client build and is not linked with it**. The client loads it at runtime, in an `iframe`, and
the two communicate only through `postMessage` and the Preview Protocol. The plugin is built in
`plasma-android` and published to the backend (`dsbuilder preview-plugin publish`); do not copy it
into `public` or commit the archive to Git.

### Where the client gets the plugin address

There are two sources, and the first one that applies wins:

1. **Direct address** `VITE_COMPOSE_PREVIEW_PLUGIN_URL`. Meant for local development (the local server below, or
   a plugin built from a feature branch). The client does not ask the backend anything. `js/docker-compose.dev.yml`
   leaves it empty by default, so the backend is used.
2. **The active build of the backend.** Without the variable the client requests
   `GET /api/projects/{projectId}/ds/compose-preview/plugin` once per page and project and loads the plugin from
   the returned `pluginUrl`. The answer does not depend on the design system version you are viewing. The build
   and the component API meta it was built from are published together, so they match.

Compose preview is offered only when one of the sources gives an address. If the backend answers `404` (nothing is
published) or fails, Compose components are not requested and the reason is written to the console; web components
keep the web plugin preview. There is no default address in the client code.

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

Start the client with `npm run dev`. The component editor offers `React / Compose` for a Compose
component only when an address is available and the plugin manifest is compatible. An unavailable
or incompatible plugin reports a failure inside the Compose viewport while React mode remains
available.

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
explains that Compose preview is unavailable.

The exception-handling probe checks the legacy `try`/`catch_all` form that Kotlin 2.1 emits. If the
plugin is rebuilt with a Kotlin version that emits `exnref`, update the probe in `environment.ts`.

The plugin entrypoint in `preview-plugin.json` must be served from the same origin as the manifest;
the client rejects a manifest whose entrypoint points elsewhere. The plugin has 30 seconds to report
`ready` (the unpacked bundle is about 12 MB, about 4 MB compressed).

### Security

The plugin runs in an `iframe` with `sandbox="allow-scripts allow-same-origin"`. If it is served from the **same
origin as the client**, that sandbox does not isolate it: the plugin code could read the client's `localStorage`,
where the access and refresh tokens live. The plugin of the shared environments lives in the same bucket as the
client, so the origins can coincide; this risk is accepted while only the SDDS team can publish plugins, and a
separate host for the plugin remains a future improvement. Mitigations in place: only a plugin published by the
team's service account or a system administrator is served; the plugin prefix is separate from the client prefix;
the write key of the plugin storage is limited to that prefix. The local server above runs on another port, so
the origins differ locally.

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

The client keeps no copy of the schema. The schema test (`src/composePreview/schema.test.ts`) reads the canonical files
from `backend-kt/preview/contract` (`schemas/v1` and the shared fixtures in `fixtures/v1/{valid,invalid}`), validates every
`valid` fixture as accepted and every `invalid` one as rejected, and checks that an assembled payload satisfies the schema.
The tests run from `js/apps/client` (`npm test`) and in CI (`Tests (client)` in `validate-js.yml`).

### PoC boundary

The smoke harness uses a versioned canonical fixture, while the component editor assembles its
payload from the current `Config`, `Theme`, variation/style selections and story descriptor.
Backend changes, deployment of the plugin to DEV/PROD, plugin publication/catalog/signatures, and
components without explicit `Meta.preview.compose` metadata remain out of scope.

## Web preview plugin

Web components are rendered only by the web preview plugin (`js/apps/preview-web-plugin`) in an `iframe`; the client
has no React stories and no web rendering of its own. The plugin keeps its own React, `@salutejs/plasma-new-hope`, the
stories, the API meta and the templates of multi-value properties. The client sends it a Preview Protocol payload with
`platform: "WEB"` built by the same assembler as Compose (`src/composePreview/webPreview.ts` → `draft.ts` +
`assembler.ts`): properties by canonical name with `tokenRef`/`literal` sources and `states`, theme tokens with the web
values converted to protocol units (`src/composePreview/webTokenValues.ts`), every style of the component and of its
related components in `styles`, the mode colors and the body font in `theme`. The plugin translates it to CSS.

- The address is resolved like the Compose one (`src/composePreview/webPluginLocation.ts`), the first source that
  applies wins:
  1. **Direct address** `VITE_WEB_PREVIEW_PLUGIN_URL`, for work on the plugin itself (see below). The client does not
     ask the backend anything.
  2. **The active web build of the backend.** Without the variable the client requests
     `GET /api/projects/{projectId}/ds/web-preview/plugin` once per page and project and loads the plugin from the
     returned `pluginUrl`. The answer does not depend on the design system version; a failed request is not cached.
     The request is made only when the components section has web components (the plugin warms up there) or a web
     component preview is shown (the component canvas of the colors section).
- If the backend answers `404` (no web build is published) or fails, with an unavailable or incompatible manifest
  (`platform` must be `web`), or when the manifest does not list the component, the preview area shows
  «Превью недоступно» with the reason; the setup panel keeps working. Compose preview does not depend on the web
  plugin address. There is no default address in the client code.
- The web plugin is published to the backend with `dsbuilder preview-plugin publish --platform react` (the archive is
  built by `npm run package` in `js/apps/preview-web-plugin`); the build and its web API meta are published together.
  The local setup (`setup-local.sh`) publishes `local-dev/web-preview/preview-web-plugin.zip` into the local MinIO.
- No WebAssembly check is done for the web plugin.
- The web plugin has its own host layer and session next to the Compose one in the components section; the component
  canvas of the colors section renders through the same plugin.
- The story controls come from the plugin `describe` answer, like in Compose mode.
- A web component with Compose metadata offers the `Renderer` switch `Плагин | Compose`.

Develop the plugin itself with a direct address:

```bash
cd js/apps/preview-web-plugin
npm install
npm run build && npm run preview   # built bundle on http://localhost:3011/ with CORS, as it will be served from S3
npm run dev                         # Vite dev server on the same port, only for work on the plugin itself
```

Prefer the built bundle: the dev server serves unbundled dependencies (`plasma-icons` alone is about 10 MB), and the
plugin then takes seconds to load in the iframe; the build is one script of about 220 kB.

Start the client with `VITE_WEB_PREVIEW_PLUGIN_URL=http://localhost:3011/` (for example in `.env.local`, or
`VITE_WEB_PREVIEW_PLUGIN_URL=http://localhost:3011/ docker compose -f docker-compose.dev.yml up -d client` in `js`).
Without the variable the client container takes the address from the backend. When the plugin is ready, pack it
with `npm run package` and publish the archive with `dsbuilder preview-plugin publish --platform react`. `npm run package` refuses to run with uncommitted
changes in `js/apps/preview-web-plugin` (the manifest records the source commit);
`PREVIEW_WEB_PLUGIN_ALLOW_DIRTY=1` skips the check only to try the packaging, such an archive is marked in the
provenance block of `local-dev/README.md` and must not be published. The deploy workflows do not set the variable: on DEV
and PROM the preview of web components is unavailable until a web build is published to the stand.

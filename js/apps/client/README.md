# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

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

## Compose preview plugin

Compose preview is an optional pilot renderer for the `Button` component. The plugin remains a
separately built and hosted production artifact; it is not copied into `public` or bundled by
Vite.

The repository contains a development build of the plugin. Start it with:

```sh
npm run dev:compose-plugin
```

The command unpacks `scripts/preview-compose-plugin.zip` into a temporary directory and serves it
at `http://127.0.0.1:8081/` with CORS enabled. The temporary directory is removed when the server
stops.

To test another artifact, pass either its ZIP or unpacked directory directly:

```sh
node scripts/serve-compose-plugin.mjs /path/to/preview-compose-plugin.zip 8081
```

Then copy `.env.example` to `.env.local` and set:

   ```text
   VITE_COMPOSE_PREVIEW_PLUGIN_URL=http://127.0.0.1:8081/
   ```

Start the client with `npm run dev`. The component editor offers `React / Compose` only for
   `Button` when the URL is configured. An unavailable or incompatible plugin reports a failure
   inside the Compose viewport while React mode remains available.

### Cross-origin browser smoke

Install the Playwright browser once with `npx playwright install chromium`, start the production
plugin at the URL above, and run:

```sh
VITE_COMPOSE_PREVIEW_PLUGIN_URL=http://127.0.0.1:8081/ npm run test:browser-smoke
```

The smoke harness uses the React `ComposePreviewFrame`, waits for manifest → ready → payload →
success, sends a changed full canonical `BasicButton` payload, and verifies the same iframe
instance reports a second success.

### PoC boundary

This PoC intentionally uses a versioned canonical fixture. It does not assemble payloads from
`Config`, `Theme`, variation/style IDs, or db-service entities. Backend changes, plugin
publication/catalog/signatures, and components other than the pilot Button remain out of scope.

import { defineConfig } from '@playwright/test';

const pluginArtifact = process.env.COMPOSE_PREVIEW_PLUGIN_ARTIFACT;
if (!pluginArtifact) {
    throw new Error(
        'COMPOSE_PREVIEW_PLUGIN_ARTIFACT must point to a built preview-compose-plugin directory or ZIP',
    );
}

export default defineConfig({
    testDir: './tests/browser',
    timeout: 30_000,
    use: {
        baseURL: 'http://127.0.0.1:4173',
    },
    webServer: [
        {
            command: `node scripts/serve-compose-plugin.mjs ${JSON.stringify(pluginArtifact)} 8082`,
            url: 'http://127.0.0.1:8082/preview-plugin.json',
            reuseExistingServer: !process.env.CI,
        },
        {
            command:
                'VITE_COMPOSE_PREVIEW_PLUGIN_URL=http://127.0.0.1:8082/ npm run dev -- --host 127.0.0.1 --port 4173',
            url: 'http://127.0.0.1:4173/compose-preview-smoke.html',
            reuseExistingServer: !process.env.CI,
        },
    ],
});

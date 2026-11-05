import { defineConfig } from '@playwright/test';

const mode = process.env.DSB_E2E_MODE;
if (mode !== undefined && mode !== '' && mode !== 'product') throw new Error('Unknown DSB_E2E_MODE');

function composeConfig() {
    const pluginArtifact = process.env.COMPOSE_PREVIEW_PLUGIN_ARTIFACT;
    if (!pluginArtifact) {
        throw new Error('COMPOSE_PREVIEW_PLUGIN_ARTIFACT must point to a built preview-compose-plugin directory or ZIP');
    }
    return defineConfig({
        testDir: './tests/browser',
        timeout: 30_000,
        use: { baseURL: 'http://127.0.0.1:4173' },
        webServer: [
            {
                command: `node scripts/serve-compose-plugin.mjs ${JSON.stringify(pluginArtifact)} 8082`,
                url: 'http://127.0.0.1:8082/preview-plugin.json',
                reuseExistingServer: !process.env.CI,
            },
            {
                command: 'VITE_COMPOSE_PREVIEW_PLUGIN_URL=http://127.0.0.1:8082/ npm run dev -- --host 127.0.0.1 --port 4173',
                url: 'http://127.0.0.1:4173/compose-preview-smoke.html',
                reuseExistingServer: !process.env.CI,
            },
        ],
    });
}

function productConfig() {
    return defineConfig({
        testDir: './tests/e2e', testMatch: '**/*.spec.ts',
        timeout: 90000, expect: { timeout: 10000 }, workers: 1, retries: 0,
        fullyParallel: false, forbidOnly: true,
        outputDir: 'test-results/product',
        reporter: [['line'], ['html', { outputFolder: 'playwright-report/product', open: 'never' }], ['json', { outputFile: 'test-results/product-report.json' }]],
        use: { browserName: 'chromium', actionTimeout: 15000, navigationTimeout: 20000, serviceWorkers: 'block', ignoreHTTPSErrors: false, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    });
}
// Выбор выполнен до чтения plugin artifact; прежний режим по умолчанию сохранён.
export default mode === 'product' ? productConfig() : composeConfig();

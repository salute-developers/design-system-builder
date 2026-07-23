import { describe, expect, it, vi } from 'vitest';

import { loadComposePreviewManifest, validateComposePreviewManifest } from './manifest';
import { compatibleManifest } from './testFixture';

describe('loadComposePreviewManifest', () => {
    it('validates the manifest and resolves its entrypoint relative to the manifest', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ ...compatibleManifest, entrypoint: './app/index.html' }), { status: 200 }),
        );

        const loaded = await loadComposePreviewManifest('https://plugin.example/releases/current', fetcher);

        expect(fetcher).toHaveBeenCalledWith(new URL('https://plugin.example/releases/current/preview-plugin.json'));
        expect(loaded.entrypointUrl.href).toBe('https://plugin.example/releases/current/app/index.html');
    });

    it('rejects an invalid base URL', async () => {
        await expect(loadComposePreviewManifest('not a url')).rejects.toThrow('Invalid Compose preview plugin URL');
    });

    it('reports network and HTTP failures', async () => {
        await expect(
            loadComposePreviewManifest('https://plugin.example/', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))),
        ).rejects.toThrow('offline');
        await expect(
            loadComposePreviewManifest(
                'https://plugin.example/',
                vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
            ),
        ).rejects.toThrow('HTTP 503');
    });

    it.each([
        ['schema', { ...compatibleManifest, schemaVersion: 2 }],
        ['platform', { ...compatibleManifest, platform: 'web' }],
        ['protocol', { ...compatibleManifest, protocolVersion: 2 }],
        ['messages', { ...compatibleManifest, payloadBridge: {} }],
        ['component', { ...compatibleManifest, components: ['Checkbox'] }],
    ])('rejects an incompatible %s', (_, manifest) => {
        expect(() => validateComposePreviewManifest(manifest)).toThrow();
    });
});

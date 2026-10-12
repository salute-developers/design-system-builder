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

    it('rejects a manifest that is not valid JSON', async () => {
        await expect(
            loadComposePreviewManifest(
                'https://plugin.example/',
                vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 })),
            ),
        ).rejects.toThrow('not valid JSON');
    });

    it('rejects a manifest without an entrypoint', () => {
        expect(() => validateComposePreviewManifest({ ...compatibleManifest, entrypoint: ' ' })).toThrow('entrypoint');
    });

    it.each([
        ['schema', { ...compatibleManifest, schemaVersion: 2 }, 'schemaVersion'],
        ['platform', { ...compatibleManifest, platform: 'web' }, 'platform'],
        ['protocol', { ...compatibleManifest, protocolVersion: 2 }, 'protocolVersion'],
        ['messages', { ...compatibleManifest, payloadBridge: {} }, 'bridge messages'],
        ['components list', { ...compatibleManifest, components: ['Button', ''] }, 'non-empty strings'],
    ])('rejects an incompatible %s', (_, manifest, message) => {
        expect(() => validateComposePreviewManifest(manifest)).toThrow(message);
    });

    it('accepts a manifest that lists other components, leaving the per-component check to the caller', () => {
        expect(validateComposePreviewManifest({ ...compatibleManifest, components: ['Checkbox'] }).components).toEqual([
            'Checkbox',
        ]);
    });

    it('rejects an entrypoint served from another origin than the manifest', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ ...compatibleManifest, entrypoint: 'https://elsewhere.example/index.html' }), {
                status: 200,
            }),
        );

        await expect(loadComposePreviewManifest('https://plugin.example/', fetcher)).rejects.toThrow('plugin origin');
    });

    it('accepts an absolute entrypoint on the plugin origin', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ ...compatibleManifest, entrypoint: 'https://plugin.example/app/index.html' }), {
                status: 200,
            }),
        );

        const loaded = await loadComposePreviewManifest('https://plugin.example/', fetcher);

        expect(loaded.entrypointUrl.href).toBe('https://plugin.example/app/index.html');
    });
});

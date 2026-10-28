import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadComposePreviewManifest, validateComposePreviewManifest } from './manifest';
import { compatibleManifest } from './testFixture';

describe('loadComposePreviewManifest', () => {
    it('validates the manifest and resolves its entrypoint relative to the manifest', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ ...compatibleManifest, entrypoint: './app/index.html' }), { status: 200 }),
        );

        const loaded = await loadComposePreviewManifest('https://plugin.example/releases/current', 'compose', fetcher);

        expect(fetcher).toHaveBeenCalledWith(new URL('https://plugin.example/releases/current/preview-plugin.json'));
        expect(loaded.entrypointUrl.href).toBe('https://plugin.example/releases/current/app/index.html');
    });

    it('rejects an invalid base URL', async () => {
        await expect(loadComposePreviewManifest('not a url')).rejects.toThrow('Invalid preview plugin URL');
    });

    it('reports network and HTTP failures', async () => {
        await expect(
            loadComposePreviewManifest('https://plugin.example/', 'compose', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))),
        ).rejects.toThrow('offline');
        await expect(
            loadComposePreviewManifest(
                'https://plugin.example/',
                'compose', vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
            ),
        ).rejects.toThrow('HTTP 503');
    });

    it('rejects a manifest that is not valid JSON', async () => {
        await expect(
            loadComposePreviewManifest(
                'https://plugin.example/',
                'compose', vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 })),
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

        await expect(loadComposePreviewManifest('https://plugin.example/', 'compose', fetcher)).rejects.toThrow('plugin origin');
    });

    it('accepts an absolute entrypoint on the plugin origin', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ ...compatibleManifest, entrypoint: 'https://plugin.example/app/index.html' }), {
                status: 200,
            }),
        );

        const loaded = await loadComposePreviewManifest('https://plugin.example/', 'compose', fetcher);

        expect(loaded.entrypointUrl.href).toBe('https://plugin.example/app/index.html');
    });
});

describe('loadComposePreviewManifest caching', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const manifestResponse = () => new Response(JSON.stringify(compatibleManifest), { status: 200 });

    it('loads the manifest once for the global fetch and reuses it', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(manifestResponse()));
        vi.stubGlobal('fetch', fetchMock);

        const first = await loadComposePreviewManifest('https://cache-once.example/');
        const second = await loadComposePreviewManifest('https://cache-once.example/');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
    });

    it('caches a manifest per plugin URL', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(manifestResponse()));
        vi.stubGlobal('fetch', fetchMock);

        await loadComposePreviewManifest('https://cache-a.example/');
        await loadComposePreviewManifest('https://cache-b.example/');

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not keep a failure in the cache', async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('', { status: 503 }))
            .mockImplementation(() => Promise.resolve(manifestResponse()));
        vi.stubGlobal('fetch', fetchMock);

        await expect(loadComposePreviewManifest('https://cache-retry.example/')).rejects.toThrow('HTTP 503');
        const loaded = await loadComposePreviewManifest('https://cache-retry.example/');

        expect(loaded.manifest.components).toEqual(compatibleManifest.components);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not cache when a fetcher is passed explicitly', async () => {
        const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(manifestResponse()));

        await loadComposePreviewManifest('https://cache-explicit.example/', 'compose', fetcher);
        await loadComposePreviewManifest('https://cache-explicit.example/', 'compose', fetcher);

        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});

describe('manifest groups', () => {
    const groups = [
        { name: 'Data Display', components: ['Avatar', 'CircularProgressBar'] },
        { name: 'Data Entry', components: ['BasicButton'] },
    ];

    it('keeps the component groups of the plugin', () => {
        expect(validateComposePreviewManifest({ ...compatibleManifest, groups }).groups).toEqual(groups);
    });

    it('treats a manifest without groups as valid', () => {
        expect(validateComposePreviewManifest(compatibleManifest)).not.toHaveProperty('groups');
    });

    it.each([
        ['not an array', { Avatar: 'Data Display' }],
        ['a group without a name', [{ components: ['Avatar'] }]],
        ['a group with an empty name', [{ name: ' ', components: ['Avatar'] }]],
        ['a group without components', [{ name: 'Data Display' }]],
        ['a group with a non-string component', [{ name: 'Data Display', components: ['Avatar', 1] }]],
    ])('drops groups of an invalid shape (%s) and keeps the manifest valid', (_, invalid) => {
        const manifest = validateComposePreviewManifest({ ...compatibleManifest, groups: invalid });

        expect(manifest).not.toHaveProperty('groups');
        expect(manifest.components).toEqual(compatibleManifest.components);
    });
});

describe('manifest platform', () => {
    const webManifest = { ...compatibleManifest, platform: 'web', components: ['Button'] };
    const respond = (manifest: unknown) =>
        vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(manifest), { status: 200 }));

    it('accepts a web manifest for the web platform', async () => {
        const loaded = await loadComposePreviewManifest('https://web-plugin.example/', 'web', respond(webManifest));

        expect(loaded.manifest.platform).toBe('web');
        expect(loaded.manifest.components).toEqual(['Button']);
    });

    it('rejects a web manifest for the compose platform', async () => {
        await expect(
            loadComposePreviewManifest('https://web-plugin.example/', 'compose', respond(webManifest)),
        ).rejects.toThrow('expected compose, got web');
        expect(() => validateComposePreviewManifest(webManifest)).toThrow('unsupported platform');
    });

    it('rejects a compose manifest for the web platform', async () => {
        await expect(
            loadComposePreviewManifest('https://plugin.example/', 'web', respond(compatibleManifest)),
        ).rejects.toThrow('expected web, got compose');
    });

    it('caches manifests of different platforms separately for the same URL', async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(webManifest), { status: 200 })));
        vi.stubGlobal('fetch', fetchMock);
        try {
            await expect(loadComposePreviewManifest('https://cache-platform.example/')).rejects.toThrow('platform');
            const loaded = await loadComposePreviewManifest('https://cache-platform.example/', 'web');

            expect(loaded.manifest.platform).toBe('web');
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

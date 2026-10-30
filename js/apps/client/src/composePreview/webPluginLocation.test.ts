import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    resetWebPreviewPluginLocation,
    resolveWebPreviewPluginUrl,
    type WebPreviewPluginDescriptor,
} from './webPluginLocation';

const descriptor = (pluginUrl: string): WebPreviewPluginDescriptor => ({
    buildId: '0123456789ab',
    platform: 'web',
    libraryVersion: '0.386.0',
    metaSha256: 'a'.repeat(64),
    protocolVersion: 1,
    pluginUrl,
    publishedAt: '2026-10-30T00:00:00Z',
});

describe('resolveWebPreviewPluginUrl', () => {
    beforeEach(() => {
        resetWebPreviewPluginLocation();
        vi.stubEnv('VITE_WEB_PREVIEW_PLUGIN_URL', '');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('takes the address of the active web build from the backend', async () => {
        const fetcher = vi.fn().mockResolvedValue(descriptor('https://plugins.test/web-preview/builds/0123456789ab/'));

        await expect(resolveWebPreviewPluginUrl('project-1', fetcher)).resolves.toBe(
            'https://plugins.test/web-preview/builds/0123456789ab/',
        );
        expect(fetcher).toHaveBeenCalledWith('project-1');
    });

    it('does not ask the backend when the direct address is set and prefers it', async () => {
        vi.stubEnv('VITE_WEB_PREVIEW_PLUGIN_URL', ' http://localhost:3011/ ');
        const fetcher = vi.fn();

        await expect(resolveWebPreviewPluginUrl('project-1', fetcher)).resolves.toBe('http://localhost:3011/');
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('offers nothing when no web build is published', async () => {
        const fetcher = vi.fn().mockResolvedValue(undefined);

        await expect(resolveWebPreviewPluginUrl('project-1', fetcher)).resolves.toBeUndefined();
    });

    it('asks once per page for a project and once for each other project', async () => {
        const fetcher = vi.fn(async (projectId: string) => descriptor(`https://plugins.test/${projectId}/`));

        await resolveWebPreviewPluginUrl('project-1', fetcher);
        await resolveWebPreviewPluginUrl('project-1', fetcher);
        await resolveWebPreviewPluginUrl('project-2', fetcher);
        const back = await resolveWebPreviewPluginUrl('project-1', fetcher);

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(back).toBe('https://plugins.test/project-1/');
    });

    it('shares one request between concurrent callers', async () => {
        let resolve: (value: WebPreviewPluginDescriptor) => void = () => undefined;
        const fetcher = vi.fn(() => new Promise<WebPreviewPluginDescriptor>((r) => (resolve = r)));

        const first = resolveWebPreviewPluginUrl('project-1', fetcher);
        const second = resolveWebPreviewPluginUrl('project-1', fetcher);
        resolve(descriptor('https://plugins.test/a/'));

        await expect(Promise.all([first, second])).resolves.toEqual([
            'https://plugins.test/a/',
            'https://plugins.test/a/',
        ]);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('does not keep a failure in the cache', async () => {
        const fetcher = vi
            .fn()
            .mockRejectedValueOnce(new Error('backend is down'))
            .mockResolvedValueOnce(descriptor('https://plugins.test/b/'));

        await expect(resolveWebPreviewPluginUrl('project-1', fetcher)).rejects.toThrow('backend is down');
        await expect(resolveWebPreviewPluginUrl('project-1', fetcher)).resolves.toBe('https://plugins.test/b/');
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('keeps the Compose plugin address independent of the web one', async () => {
        const { getComposePreviewPluginUrl, resetComposePreviewPluginLocation } = await import('./pluginLocation');
        resetComposePreviewPluginLocation();

        await resolveWebPreviewPluginUrl('project-1', vi.fn().mockResolvedValue(undefined));

        expect(getComposePreviewPluginUrl()).toBeUndefined();
    });
});

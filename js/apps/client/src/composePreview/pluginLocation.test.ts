import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getComposePreviewPluginUrl,
    resetComposePreviewPluginLocation,
    resolveComposePreviewPluginUrl,
    type ComposePreviewPluginDescriptor,
} from './pluginLocation';

const descriptor = (pluginUrl: string): ComposePreviewPluginDescriptor => ({
    buildId: '0123456789ab',
    uikitComposeVersion: '0.55.0',
    pluginUrl,
});

describe('resolveComposePreviewPluginUrl', () => {
    beforeEach(() => {
        resetComposePreviewPluginLocation();
        vi.stubEnv('VITE_COMPOSE_PREVIEW_PLUGIN_URL', '');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('takes the address of the active build from the backend', async () => {
        const fetcher = vi.fn().mockResolvedValue(descriptor('https://plugins.test/builds/0123456789ab/'));

        await expect(resolveComposePreviewPluginUrl('project-1', fetcher)).resolves.toBe(
            'https://plugins.test/builds/0123456789ab/',
        );
        expect(fetcher).toHaveBeenCalledWith('project-1');
        expect(getComposePreviewPluginUrl()).toBe('https://plugins.test/builds/0123456789ab/');
    });

    it('does not ask the backend when the direct address is set and prefers it', async () => {
        vi.stubEnv('VITE_COMPOSE_PREVIEW_PLUGIN_URL', ' http://127.0.0.1:8081/ ');
        const fetcher = vi.fn();

        await expect(resolveComposePreviewPluginUrl('project-1', fetcher)).resolves.toBe('http://127.0.0.1:8081/');
        expect(fetcher).not.toHaveBeenCalled();
        expect(getComposePreviewPluginUrl()).toBe('http://127.0.0.1:8081/');
    });

    it('offers nothing when no build is published', async () => {
        const fetcher = vi.fn().mockResolvedValue(undefined);

        await expect(resolveComposePreviewPluginUrl('project-1', fetcher)).resolves.toBeUndefined();
        expect(getComposePreviewPluginUrl()).toBeUndefined();
    });

    it('asks once per page for a project and once for each other project', async () => {
        const fetcher = vi.fn(async (projectId: string) => descriptor(`https://plugins.test/${projectId}/`));

        await resolveComposePreviewPluginUrl('project-1', fetcher);
        await resolveComposePreviewPluginUrl('project-1', fetcher);
        await resolveComposePreviewPluginUrl('project-2', fetcher);
        const back = await resolveComposePreviewPluginUrl('project-1', fetcher);

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(back).toBe('https://plugins.test/project-1/');
        expect(getComposePreviewPluginUrl()).toBe('https://plugins.test/project-1/');
    });

    it('shares one request between concurrent callers', async () => {
        let resolve: (value: ComposePreviewPluginDescriptor) => void = () => undefined;
        const fetcher = vi.fn(() => new Promise<ComposePreviewPluginDescriptor>((r) => (resolve = r)));

        const first = resolveComposePreviewPluginUrl('project-1', fetcher);
        const second = resolveComposePreviewPluginUrl('project-1', fetcher);
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

        await expect(resolveComposePreviewPluginUrl('project-1', fetcher)).rejects.toThrow('backend is down');
        await expect(resolveComposePreviewPluginUrl('project-1', fetcher)).resolves.toBe('https://plugins.test/b/');
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./http', () => ({ http: { get } }));
vi.mock('./constants', () => ({ PROJECTS_URL: 'https://api.test/api/projects', API_GATEWAY_URL: 'https://api.test' }));

import { fetchComposePreviewPluginDescriptor } from './composePreviewPluginRepository';

const notFound = () =>
    new AxiosError('Not found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        data: {},
        headers: {},
        config: { headers: {} } as never,
    });

describe('fetchComposePreviewPluginDescriptor', () => {
    beforeEach(() => {
        get.mockReset();
    });

    it('reads the active build from the project route without a design system version', async () => {
        const data = { buildId: '0123456789ab', uikitComposeVersion: '0.55.0', pluginUrl: 'https://plugins.test/b/' };
        get.mockResolvedValue({ data });

        await expect(fetchComposePreviewPluginDescriptor('project-1')).resolves.toEqual(data);

        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith('https://api.test/api/projects/project-1/ds/compose-preview/plugin');
    });

    it('treats 404 as "no plugin is published"', async () => {
        get.mockRejectedValue(notFound());

        await expect(fetchComposePreviewPluginDescriptor('project-1')).resolves.toBeUndefined();
    });

    it('lets other failures through so the caller can disable Compose preview', async () => {
        get.mockRejectedValue(new Error('network'));

        await expect(fetchComposePreviewPluginDescriptor('project-1')).rejects.toThrow('network');
    });

    it('rejects an answer without a usable address', async () => {
        for (const data of [null, {}, { buildId: 'a', uikitComposeVersion: '1', pluginUrl: ' ' }, 'text']) {
            get.mockResolvedValue({ data });

            await expect(fetchComposePreviewPluginDescriptor('project-1')).rejects.toThrow(/некорректное описание/);
        }
    });
});

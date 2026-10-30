import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./http', () => ({ http: { get } }));
vi.mock('./constants', () => ({ PROJECTS_URL: 'https://api.test/api/projects', API_GATEWAY_URL: 'https://api.test' }));

import { fetchWebPreviewPluginDescriptor } from './webPreviewPluginRepository';

const notFound = () =>
    new AxiosError('Not found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        data: {},
        headers: {},
        config: { headers: {} } as never,
    });

describe('fetchWebPreviewPluginDescriptor', () => {
    beforeEach(() => {
        get.mockReset();
    });

    it('reads the active web build from the project route without a design system version', async () => {
        const data = {
            buildId: '0123456789ab',
            platform: 'web',
            libraryVersion: '0.386.0',
            metaSha256: 'a'.repeat(64),
            protocolVersion: 1,
            pluginUrl: 'https://plugins.test/web-preview/builds/0123456789ab/',
            publishedAt: '2026-10-30T00:00:00Z',
        };
        get.mockResolvedValue({ data });

        await expect(fetchWebPreviewPluginDescriptor('project-1')).resolves.toEqual(data);

        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith('https://api.test/api/projects/project-1/ds/web-preview/plugin');
    });

    it('treats 404 as "no web plugin is published"', async () => {
        get.mockRejectedValue(notFound());

        await expect(fetchWebPreviewPluginDescriptor('project-1')).resolves.toBeUndefined();
    });

    it('lets other failures through so the caller can disable web preview', async () => {
        get.mockRejectedValue(new Error('network'));

        await expect(fetchWebPreviewPluginDescriptor('project-1')).rejects.toThrow('network');
    });

    it('rejects an answer without a usable address', async () => {
        for (const data of [null, {}, { buildId: 'a', pluginUrl: ' ' }, { pluginUrl: 'https://plugins.test/' }, 'text']) {
            get.mockResolvedValue({ data });

            await expect(fetchWebPreviewPluginDescriptor('project-1')).rejects.toThrow(/некорректное описание/);
        }
    });
});

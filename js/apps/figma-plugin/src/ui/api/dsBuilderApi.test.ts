import { describe, expect, it, vi } from 'vitest';

import { createDsBuilderApi } from './dsBuilderApi';
import type { HttpClient, RequestOptions } from './httpClient';

const context = { projectId: 'p 1', designSystemId: 'd1', tenantId: 't1' };

const createHttp = () => {
    const get = vi.fn<(path: string, options?: RequestOptions) => Promise<unknown>>(async (path) => {
        if (path.endsWith('typography-styles')) return { families: [], screens: [] };
        if (path.endsWith('size-tokens')) return {};
        return [];
    });
    return { get, http: { get } as unknown as HttpClient };
};

describe('чтения DS Builder', () => {
    it('читает все части снимка на одной границе версии', async () => {
        const { http, get } = createHttp();

        await createDsBuilderApi(http).snapshot(context, 'v1');

        expect(get.mock.calls.map(([path]) => path)).toEqual([
            '/api/projects/p%201/ds/design-systems/d1/tokens',
            '/api/projects/p%201/ds/tenants/t1/token-values',
            '/api/projects/p%201/ds/tenants/t1/typography-styles',
            '/api/projects/p%201/ds/tenants/t1/size-tokens',
        ]);
        get.mock.calls.forEach(([, options]) => expect(options?.params?.versionId).toBe('v1'));
        expect(get.mock.calls[1][1]?.params?.types).toBe('color,gradient');
    });

    it('читает черновик без `versionId` и передаёт отмену', async () => {
        const { http, get } = createHttp();
        const { signal } = new AbortController();

        await createDsBuilderApi(http).snapshot(context, null, signal);

        expect(get).toHaveBeenCalledTimes(4);
        get.mock.calls.forEach(([, options]) => {
            expect(options?.params?.versionId).toBeNull();
            expect(options?.signal).toBe(signal);
        });
    });

    it('подписывает тему без названия', async () => {
        const { http, get } = createHttp();
        get.mockResolvedValueOnce([{ id: 't1', name: null }]);

        await expect(createDsBuilderApi(http).tenants(context)).resolves.toEqual([
            { id: 't1', name: 'Тема без названия' },
        ]);
    });
});

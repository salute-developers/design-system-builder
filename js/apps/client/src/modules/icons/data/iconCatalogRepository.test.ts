import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../../api/http', () => ({ http: { get } }));
vi.mock('../../../api/constants', () => ({ PROJECTS_URL: 'https://api.test/api/projects' }));

import { catalogFixture } from '../__fixtures__/catalog';
import { getIconCatalog, resetIconCatalogCache } from './iconCatalogRepository';

describe('getIconCatalog', () => {
    beforeEach(() => {
        get.mockReset();
        resetIconCatalogCache();
    });

    it('reads the project route and sends If-None-Match on the second request', async () => {
        get.mockResolvedValueOnce({ status: 200, data: catalogFixture, headers: { etag: '"3fa9c01d27be"' } });
        await expect(getIconCatalog('p1')).resolves.toEqual(catalogFixture);
        expect(get.mock.calls[0][0]).toBe('https://api.test/api/projects/p1/design-systems/catalog/icons');

        get.mockResolvedValueOnce({ status: 304, data: '', headers: {} });
        await expect(getIconCatalog('p1')).resolves.toEqual(catalogFixture);
        expect(get.mock.calls[1][1].headers).toEqual({ 'If-None-Match': '"3fa9c01d27be"' });
    });

    it('returns an empty catalog as is', async () => {
        get.mockResolvedValue({ status: 200, data: { source: null, assetsBaseUrl: '', icons: [] }, headers: {} });
        await expect(getIconCatalog('p1')).resolves.toMatchObject({ icons: [], source: null });
    });

    it('accepts the answer of an environment without a catalog (null source and base address)', async () => {
        get.mockResolvedValue({ status: 200, data: { source: null, assetsBaseUrl: null, icons: [] }, headers: {} });
        await expect(getIconCatalog('p1')).resolves.toEqual({ source: null, assetsBaseUrl: '', icons: [] });
    });

    it('rejects a malformed body', async () => {
        get.mockResolvedValue({ status: 200, data: { foo: 1 }, headers: {} });
        await expect(getIconCatalog('p1')).rejects.toMatchObject({ code: 'invalid_catalog' });
    });
});

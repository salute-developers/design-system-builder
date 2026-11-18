import { afterEach, describe, expect, it, vi } from 'vitest';

import * as draftActivity from './draftAutosaveActivity';
import { http } from './http';
import { saveTokenEnabled } from './tokenEnabled';

afterEach(() => vi.restoreAllMocks());

describe('saveTokenEnabled', () => {
    it('меняет признак у каждого определения запросом PATCH /tokens/{id}', async () => {
        const patch = vi.spyOn(http, 'patch').mockResolvedValue({ data: {} } as never);

        const saved = vi.spyOn(draftActivity, 'recordDraftSave');

        await saveTokenEnabled({ projectId: 'p', designSystemId: 'ds', tenantId: 't' }, ['a', 'b/c'], false, ['shape']);

        expect(patch).toHaveBeenCalledTimes(2);
        expect(patch.mock.calls[0][0]).toMatch(/\/projects\/p\/design-systems\/ds\/tokens\/a$/);
        expect(patch.mock.calls[1][0]).toMatch(/\/tokens\/b%2Fc$/);
        expect(patch.mock.calls[0][1]).toEqual({ enabled: false });
        // Вся пачка — одна операция черновика: раздел перечитывается один раз.
        expect(saved).toHaveBeenCalledTimes(1);
        expect(saved.mock.calls[0]).toContainEqual(['shape']);
    });

    it('останавливается на первом сбое', async () => {
        const patch = vi.spyOn(http, 'patch').mockRejectedValueOnce(new Error('network'));

        await expect(
            saveTokenEnabled({ projectId: 'p', designSystemId: 'ds', tenantId: 't' }, ['a', 'b'], true, ['color']),
        ).rejects.toThrow();
        expect(patch).toHaveBeenCalledTimes(1);
    });
});

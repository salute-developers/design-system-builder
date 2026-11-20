import { expect, it, vi } from 'vitest';
import type { DesignSystem, Theme } from '../controllers';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../api', () => ({ http: { get, put }, PROJECTS_URL: '/api/projects' }));
vi.mock('../controllers', () => ({ createMetaTokens: () => ({}), createVariationTokens: () => ({}) }));
import { designSystemSave } from './Main.utils';

it('сохраняет локальный контекст темы через единственный системный корень', async () => {
    const parameters = { projectId: 'project', designSystemId: 'system', tenantId: 'tenant', editRevision: 7 };
    const model = { getParameters: () => parameters } as unknown as DesignSystem;
    get.mockResolvedValue({ data: [] });
    put.mockResolvedValue({ data: { editRevision: 8 } });
    await designSystemSave(model, {} as Theme, []);
    expect(get).toHaveBeenCalledWith('/api/projects/project/design-systems/system/tokens');
    expect(put).toHaveBeenCalledWith('/api/projects/project/design-systems/system/tenants/tenant/token-values', {
        editRevision: 7,
        values: [],
    });
    expect(parameters.editRevision).toBe(8);
});

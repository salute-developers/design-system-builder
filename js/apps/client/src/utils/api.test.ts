import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api', () => ({ http: { get }, PROJECTS_URL: '/api/projects' }));

import { loadDesignSystem } from './api';

const urls = () => get.mock.calls.map(([url]) => String(url));

describe('loadDesignSystem component configs', () => {
    beforeEach(() => {
        get.mockReset();
        get.mockImplementation((url: string) =>
            Promise.resolve({ data: url.endsWith('/component-configs') ? [{ name: 'Button' }] : {} }),
        );
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('requests component configs when the component editor is enabled', async () => {
        vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'true');

        const result = await loadDesignSystem({ name: 'ds', version: '0.1.0', projectId: 'p1' });

        expect(urls().filter((url) => url.endsWith('/component-configs'))).toHaveLength(1);
        expect(result?.componentsData).toEqual([{ name: 'Button' }]);
    });

    it('does not request component configs when the component editor is disabled', async () => {
        vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'false');

        const result = await loadDesignSystem({ name: 'ds', version: '0.1.0', projectId: 'p1' });

        expect(urls().filter((url) => url.endsWith('/component-configs'))).toHaveLength(0);
        expect(result?.componentsData).toEqual([]);
        expect(urls().some((url) => url.endsWith('/theme-data'))).toBe(true);
    });
});

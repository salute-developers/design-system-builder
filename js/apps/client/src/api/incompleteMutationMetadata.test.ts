import { describe, expect, it, vi } from 'vitest';
import { reportIncompleteMutationMetadata, subscribeIncompleteMutationMetadata } from './incompleteMutationMetadata';

const context = { projectId: 'p1', designSystemId: 'ds1', tenantId: 't1' };
const report = (url: string, truncated = 'true') =>
    reportIncompleteMutationMetadata({ headers: { 'x-ds-mutation-metadata-truncated': truncated }, config: { url } });

describe('incomplete mutation metadata', () => {
    it('refreshes only the relevant data in the same project and unsubscribes', () => {
        const refresh = vi.fn();
        const cancel = subscribeIncompleteMutationMetadata(context, refresh);
        report('/api/projects/p2/ds/tenants/t1/palette');
        report('/api/projects/p1/ds/tenants/t1/palette', 'false');
        expect(refresh).not.toHaveBeenCalled();
        report('http://localhost:8080/api/projects/p1/ds/tenants/t1/color-tokens');
        expect(refresh).toHaveBeenLastCalledWith('theme-tokens');
        report('/api/projects/p1/ds/appearances');
        expect(refresh).toHaveBeenLastCalledWith('all');
        cancel();
        report('/api/projects/p1/ds/tenants/t1/palette');
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('does not change an open historical version', () => {
        const refresh = vi.fn();
        const cancel = subscribeIncompleteMutationMetadata({ ...context, versionId: 'v1' }, refresh);
        report('/api/projects/p1/ds/tenants/t1/palette');
        expect(refresh).not.toHaveBeenCalled();
        cancel();
    });
});

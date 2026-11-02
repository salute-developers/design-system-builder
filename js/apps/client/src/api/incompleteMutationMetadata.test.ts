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
        report('/api/projects/p1/ds/tenants/t1/size-tokens/token-1/value');
        expect(refresh).toHaveBeenLastCalledWith('theme-tokens');
        report('/api/projects/p1/ds/appearances');
        expect(refresh).toHaveBeenLastCalledWith('all');
        report('/api/projects/p1/ds/tenants/t1/typography-styles/token-1');
        expect(refresh).toHaveBeenLastCalledWith('theme-tokens');
        cancel();
        report('/api/projects/p1/ds/tenants/t1/palette');
        expect(refresh).toHaveBeenCalledTimes(5);
    });

    it('does not change an open historical version', () => {
        const refresh = vi.fn();
        const cancel = subscribeIncompleteMutationMetadata({ ...context, versionId: 'v1' }, refresh);
        report('/api/projects/p1/ds/tenants/t1/palette');
        expect(refresh).not.toHaveBeenCalled();
        cancel();
    });
});

it('полное подтверждение своей темы подавляет только fallback значения, но не чужую или неизвестную операцию', () => {
    const refresh = vi.fn();
    const cancel = subscribeIncompleteMutationMetadata(context, refresh);
    const response = {
        headers: { 'x-ds-mutation-metadata-truncated': 'true' },
        config: { url: '/api/projects/p1/ds/tenants/t1/color-tokens/token/values' },
        data: {
            type: 'color',
            confirmedValues: [
                {
                    id: 'v',
                    tokenId: 'token',
                    tenantId: 't1',
                    platform: 'web',
                    mode: 'light',
                    value: '#000000',
                    editRevision: 1,
                },
            ],
        },
    };
    reportIncompleteMutationMetadata(response);
    expect(refresh).not.toHaveBeenCalled();
    reportIncompleteMutationMetadata({
        ...response,
        data: { ...response.data, confirmedValues: [{ ...response.data.confirmedValues[0], tenantId: 'other' }] },
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    reportIncompleteMutationMetadata({ ...response, config: { url: '/api/projects/p1/ds/tenants/t1/palette' } });
    expect(refresh).toHaveBeenCalledTimes(2);
    cancel();
});

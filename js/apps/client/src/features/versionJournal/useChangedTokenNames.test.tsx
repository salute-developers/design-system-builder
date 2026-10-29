import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftChangeDto, TokenDefinitionDto } from '../../api/editorContracts';
import { useChangedTokenNames } from './useChangedTokenNames';

const { listChanges } = vi.hoisted(() => ({ listChanges: vi.fn() }));
vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: { listChanges } }));
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
const context = { projectId: 'p', designSystemId: 'ds', tenantId: 'theme' };
const definitions = [
    { id: 'shadow', name: 'shadow.default.small' },
    { id: 'other', name: 'shape.default.large' },
] as TokenDefinitionDto[];
const valueChange = (tokenId: string, tenantId = 'theme') =>
    ({
        entityType: 'token-value',
        entityId: `value-${tokenId}`,
        currentValue: { token_id: tokenId, tenant_id: tenantId },
    }) as DraftChangeDto;

describe('unpublished token indicators', () => {
    it('keeps saved draft changes, excludes other themes and clears after publication or revert', async () => {
        listChanges.mockResolvedValue([valueChange('shadow'), valueChange('other', 'another-theme')]);
        const { result, rerender } = renderHook(
            ({ revision }) => useChangedTokenNames(context, definitions, revision, true),
            { initialProps: { revision: 1 } },
        );
        await waitFor(() => expect(result.current).toEqual(new Set(['shadow.default.small'])));
        listChanges.mockResolvedValue([]);
        rerender({ revision: 2 });
        await waitFor(() => expect(result.current).toEqual(new Set()));
    });

    it('ignores late responses from a previous theme and skips published versions', async () => {
        let resolve!: (changes: DraftChangeDto[]) => void;
        listChanges.mockReturnValue(
            new Promise<DraftChangeDto[]>((done) => {
                resolve = done;
            }),
        );
        const { result, rerender } = renderHook(
            ({ versionId }) => useChangedTokenNames({ ...context, versionId }, definitions, 1, true),
            { initialProps: { versionId: undefined as string | undefined } },
        );
        rerender({ versionId: 'published' });
        await act(async () => resolve([valueChange('shadow')]));
        expect(result.current).toBeUndefined();
        expect(listChanges).toHaveBeenCalledTimes(1);
    });
});

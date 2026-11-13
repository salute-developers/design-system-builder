import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenDefinitionDto } from '../../api/editorContracts';
import { useChangedTokenNames } from './useChangedTokenNames';

const { listChangedTokenIds } = vi.hoisted(() => ({ listChangedTokenIds: vi.fn() }));
vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: { listChangedTokenIds } }));
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
const context = { projectId: 'p', designSystemId: 'ds', tenantId: 'theme' };
const definitions = [
    { id: 'shadow', name: 'shadow.default.small' },
    { id: 'other', name: 'shape.default.large' },
] as TokenDefinitionDto[];
describe('unpublished token indicators', () => {
    it('keeps saved draft changes, excludes other themes and clears after publication or revert', async () => {
        listChangedTokenIds.mockResolvedValue(['shadow']);
        const { result, rerender } = renderHook(
            ({ revision }) => useChangedTokenNames(context, definitions, revision, true),
            { initialProps: { revision: 1 } },
        );
        await waitFor(() => expect(result.current).toEqual(new Set(['shadow.default.small'])));
        listChangedTokenIds.mockResolvedValue([]);
        rerender({ revision: 2 });
        await waitFor(() => expect(result.current).toEqual(new Set()));
    });

    it('ignores late responses from a previous theme and skips published versions', async () => {
        let resolve!: (changes: string[]) => void;
        listChangedTokenIds.mockReturnValue(
            new Promise<string[]>((done) => {
                resolve = done;
            }),
        );
        const { result, rerender } = renderHook(
            ({ versionId }) => useChangedTokenNames({ ...context, versionId }, definitions, 1, true),
            { initialProps: { versionId: undefined as string | undefined } },
        );
        rerender({ versionId: 'published' });
        await act(async () => resolve(['shadow']));
        expect(result.current).toBeUndefined();
        expect(listChangedTokenIds).toHaveBeenCalledTimes(1);
    });
});

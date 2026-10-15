import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { load, saveTokenMutation } = vi.hoisted(() => ({
    load: vi.fn(),
    saveTokenMutation: vi.fn(),
}));
const { applyDraftChanges } = vi.hoisted(() => ({
    applyDraftChanges: vi.fn(),
}));

vi.mock('../api/themeEditorRepository', () => ({
    ThemeEditorRepository: class {
        load = load;
        saveTokenMutation = saveTokenMutation;
    },
}));
vi.mock('../utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../utils')>()),
    applyDraftChanges,
}));

vi.mock('../controllers', () => ({
    DesignSystem: {
        fromSnapshot: () => ({
            createThemeInstance: () => ({ getToken: () => undefined, addToken: vi.fn() }),
            createAllComponentInstances: () => [],
        }),
    },
    Config: class {},
    Theme: class {},
    AndroidColor: class {},
    AndroidGradient: class {},
    AndroidShadow: class {},
    AndroidShape: class {},
    AndroidSpacing: class {},
    AndroidTypography: class {},
    ColorToken: class {},
    GradientToken: class {},
    IOSColor: class {},
    IOSGradient: class {},
    IOSShadow: class {},
    IOSShape: class {},
    IOSSpacing: class {},
    IOSTypography: class {},
    ShadowToken: class {},
    ShapeToken: class {},
    SpacingToken: class {},
    TypographyToken: class {},
    WebColor: class {},
    WebGradient: class {},
    WebShadow: class {},
    WebShape: class {},
    WebSpacing: class {},
    WebTypography: class {},
}));

import { useDesignSystem } from './useDesignSystem';
import {
    createDraftToken,
    getDraftKey,
    pendingDraftTokens,
    renameDraftToken,
    setActiveDraftContext,
    updateDraftToken,
} from '../utils/designSystemDraft';
import type { Token } from '../controllers';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
const token = {
    getName: () => 'accent',
    getTags: () => ['accent'],
    getDisplayName: () => 'Accent',
    getType: () => 'color',
    getValue: () => '#123456',
    getDescription: () => 'Accent',
    getEnabled: () => true,
} as unknown as Token;

const Probe = () => {
    const state = useDesignSystem(context);
    return <span>{state.designSystem ? 'loaded' : 'loading'}</span>;
};

const ProbeWithContext = ({ editorContext }: { editorContext: typeof context }) => {
    const state = useDesignSystem(editorContext);
    return <span>{state.designSystem ? 'loaded' : 'loading'}</span>;
};

beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    load.mockReset().mockResolvedValue({
        designSystem: { id: 'ds-1', name: 'System' },
        tenant: { id: 'tenant-1', designSystemId: 'ds-1', name: 'Theme' },
        themeData: { meta: { tokens: [] }, variations: {} },
        componentsData: [],
        parameters: {},
        editRevision: 3,
        incompleteTokenIds: [],
        tokenIdsByName: { accent: 'token-1' },
        tokenDefinitionsByName: {
            accent: {
                id: 'token-1',
                designSystemId: 'ds-1',
                name: 'accent',
                type: 'color',
                displayName: 'Accent',
                description: 'Accent',
                enabled: true,
            },
        },
        tokenValueRevisionsByKey: {
            'token-1:web:': 2,
            'token-1:ios:': 3,
            'token-1:android:': 4,
        },
        publicationVersion: '0.1.0',
    });
    saveTokenMutation.mockReset().mockResolvedValue({
        tokenId: 'token-1',
        editRevision: 4,
        baseRevision: 5,
        valueBaseRevisions: {},
    });
    applyDraftChanges.mockReset();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('useDesignSystem server autosave', () => {
    it('does not mix an active local draft into a published version', async () => {
        const { setActiveDraftContext } = await import('../utils/designSystemDraft');
        setActiveDraftContext(context);
        updateDraftToken('System', '0.1.0', token);
        const historicalContext = { ...context, versionId: 'version-1' };

        render(<ProbeWithContext editorContext={historicalContext} />);
        await act(async () => Promise.resolve());
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
        });

        expect(screen.getByText('loaded')).toBeInTheDocument();
        expect(applyDraftChanges).not.toHaveBeenCalled();
        expect(saveTokenMutation).not.toHaveBeenCalled();
        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).toContain('#123456');
    });

    it('debounces a pending change and removes it only after confirmation', async () => {
        render(<Probe />);
        await act(async () => Promise.resolve());
        expect(screen.getByText('loaded')).toBeInTheDocument();

        act(() => updateDraftToken('System', '0.1.0', token));
        const draftKey = getDraftKey('System', '0.1.0');
        expect(localStorage.getItem(draftKey)).toContain('#123456');
        expect(saveTokenMutation).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
        });
        expect(saveTokenMutation).toHaveBeenCalledOnce();
        expect(localStorage.getItem(draftKey)).toBeNull();
    });

    it('stores compact request metadata without duplicating the token body', async () => {
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() => updateDraftToken('System', '0.1.0', token));

        const metadata = JSON.parse(
            localStorage.getItem('ds_pending_meta:project-1:ds-1:tenant-1:accent') ?? '{}',
        ) as Record<string, unknown>;
        expect(metadata).not.toHaveProperty('change');
        expect(metadata).not.toHaveProperty('definitionPatch');
        expect(metadata.fingerprint).toMatch(/^\d+:[0-9a-f]+$/);
        expect(metadata.valueBaseRevisions).toEqual({
            'token-1:web:': 2,
            'token-1:ios:': 3,
            'token-1:android:': 4,
        });
    });

    it('loads and saves from memory when request metadata exceeds the storage quota', async () => {
        setActiveDraftContext(context);
        updateDraftToken('System', '0.1.0', token);
        const originalSetItem = localStorage.setItem.bind(localStorage);
        const storage = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
            if (key.startsWith('ds_pending_meta:')) throw new DOMException('quota exceeded', 'QuotaExceededError');
            originalSetItem(key, value);
        });
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        render(<Probe />);
        await act(async () => Promise.resolve());
        await act(async () => vi.runAllTimersAsync());

        expect(screen.getByText('loaded')).toBeInTheDocument();
        expect(saveTokenMutation).toHaveBeenCalledOnce();
        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).toBeNull();
        expect(warning).toHaveBeenCalledWith(
            '[useDesignSystem] Не удалось сохранить служебные данные автосохранения',
            expect.objectContaining({ name: 'QuotaExceededError' }),
        );
        storage.mockRestore();
        warning.mockRestore();
    });

    it('replays an isolated unconfirmed request after the editor is reopened', async () => {
        const { setActiveDraftContext } = await import('../utils/designSystemDraft');
        setActiveDraftContext(context);
        updateDraftToken('System', '0.1.0', token);

        render(<Probe />);
        await act(async () => Promise.resolve());
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
        });

        expect(saveTokenMutation).toHaveBeenCalledWith(
            context,
            'token-1',
            expect.objectContaining({ tokenName: 'accent', kind: 'update' }),
            3,
            0,
            {
                'token-1:web:': 2,
                'token-1:ios:': 3,
                'token-1:android:': 4,
            },
            expect.any(String),
            false,
        );
        expect(localStorage.getItem(getDraftKey('System', '0.1.0'))).toBeNull();
    });

    it('renames the existing token by its stable id instead of creating another token', async () => {
        const renamedToken = {
            ...token,
            getName: () => 'accent-renamed',
            getTags: () => ['accent-renamed'],
            getDisplayName: () => 'Accent renamed',
        } as unknown as Token;
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() => renameDraftToken('System', '0.1.0', 'accent', renamedToken));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
        });

        expect(saveTokenMutation).toHaveBeenCalledWith(
            context,
            'token-1',
            expect.objectContaining({
                tokenName: 'accent-renamed',
                previousTokenName: 'accent',
                kind: 'rename',
            }),
            3,
            0,
            expect.any(Object),
            expect.any(String),
            false,
        );
    });

    it('serializes an edit after rename by the same stable token id', async () => {
        let finishRename: ((value: Awaited<ReturnType<typeof saveTokenMutation>>) => void) | undefined;
        const renameSave = new Promise<Awaited<ReturnType<typeof saveTokenMutation>>>((resolve) => {
            finishRename = resolve;
        });
        saveTokenMutation.mockReturnValueOnce(renameSave);
        const renamedToken = {
            ...token,
            getName: () => 'accent-renamed',
            getTags: () => ['accent-renamed'],
            getDisplayName: () => 'Accent renamed',
        } as unknown as Token;
        const editedToken = { ...renamedToken, getValue: () => '#654321' } as unknown as Token;
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() => renameDraftToken('System', '0.1.0', 'accent', renamedToken));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
        });
        act(() => updateDraftToken('System', '0.1.0', editedToken));
        expect(saveTokenMutation).toHaveBeenCalledTimes(1);

        await act(async () => {
            finishRename?.({ tokenId: 'token-1', editRevision: 4, baseRevision: 5, valueBaseRevisions: {} });
            await renameSave;
            await vi.runAllTimersAsync();
        });

        expect(saveTokenMutation).toHaveBeenCalledTimes(2);
        expect(saveTokenMutation.mock.calls[1][1]).toBe('token-1');
        expect(saveTokenMutation.mock.calls[1][2]).toEqual(
            expect.objectContaining({ tokenName: 'accent-renamed', kind: 'update' }),
        );
    });

    it('serializes recreation of a freed name after rename and creates a new token', async () => {
        let finishRename: ((value: Awaited<ReturnType<typeof saveTokenMutation>>) => void) | undefined;
        const renameSave = new Promise<Awaited<ReturnType<typeof saveTokenMutation>>>((resolve) => {
            finishRename = resolve;
        });
        saveTokenMutation
            .mockReturnValueOnce(renameSave)
            .mockResolvedValueOnce({ tokenId: 'token-2', editRevision: 5, baseRevision: 1, valueBaseRevisions: {} });
        const renamedToken = {
            ...token,
            getName: () => 'accent-renamed',
            getTags: () => ['accent-renamed'],
            getDisplayName: () => 'Accent renamed',
        } as unknown as Token;
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() => renameDraftToken('System', '0.1.0', 'accent', renamedToken));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
        });
        act(() => createDraftToken('System', '0.1.0', token));
        expect(saveTokenMutation).toHaveBeenCalledTimes(1);

        await act(async () => {
            finishRename?.({ tokenId: 'token-1', editRevision: 4, baseRevision: 5, valueBaseRevisions: {} });
            await renameSave;
            await vi.runAllTimersAsync();
        });

        expect(saveTokenMutation).toHaveBeenCalledTimes(2);
        expect(saveTokenMutation.mock.calls[1][1]).toBeUndefined();
        expect(saveTokenMutation.mock.calls[1][2]).toEqual(expect.objectContaining({ tokenName: 'accent', kind: 'create' }));
    });

    it('creates a new token when an old name is reused after rename confirmation', async () => {
        const renamedToken = {
            ...token,
            getName: () => 'accent-renamed',
            getTags: () => ['accent-renamed'],
            getDisplayName: () => 'Accent renamed',
        } as unknown as Token;
        saveTokenMutation
            .mockResolvedValueOnce({ tokenId: 'token-1', editRevision: 4, baseRevision: 5, valueBaseRevisions: {} })
            .mockResolvedValueOnce({ tokenId: 'token-2', editRevision: 5, baseRevision: 1, valueBaseRevisions: {} });
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() => renameDraftToken('System', '0.1.0', 'accent', renamedToken));
        await act(async () => vi.runAllTimersAsync());
        act(() => createDraftToken('System', '0.1.0', token));
        await act(async () => vi.runAllTimersAsync());

        expect(saveTokenMutation).toHaveBeenCalledTimes(2);
        expect(saveTokenMutation.mock.calls[1][1]).toBeUndefined();
        expect(saveTokenMutation.mock.calls[1][2]).toEqual(expect.objectContaining({ tokenName: 'accent', kind: 'create' }));
    });

    it('restores the exact rename operation after reopening the editor', async () => {
        const renamedToken = {
            ...token,
            getName: () => 'accent-renamed',
            getTags: () => ['accent-renamed'],
            getDisplayName: () => 'Accent renamed',
        } as unknown as Token;
        setActiveDraftContext(context);
        renameDraftToken('System', '0.1.0', 'accent', renamedToken);
        const change = pendingDraftTokens('System', '0.1.0')['accent-renamed'];
        const fingerprint = JSON.stringify({
            tokenName: 'accent-renamed',
            previousTokenName: 'accent',
            change,
            kind: 'rename',
        });
        localStorage.setItem(
            'ds_pending_meta:project-1:ds-1:tenant-1:accent-renamed',
            JSON.stringify({
                tokenKey: 'token:token-1',
                entityKey: 'token:token-1',
                operationKey: 'accent-renamed',
                generation: 'rename-generation',
                retryCount: 0,
                tokenName: 'accent-renamed',
                previousTokenName: 'accent',
                change,
                kind: 'rename',
                fingerprint,
                idempotencyKey: 'rename-request',
                editRevision: 3,
                tokenBaseRevision: 0,
                valueBaseRevisions: {},
                metadataKey: 'ds_pending_meta:project-1:ds-1:tenant-1:accent-renamed',
            }),
        );

        render(<Probe />);
        await act(async () => Promise.resolve());
        await act(async () => vi.runAllTimersAsync());

        expect(saveTokenMutation).toHaveBeenCalledWith(
            context,
            'token-1',
            expect.objectContaining({
                tokenName: 'accent-renamed',
                previousTokenName: 'accent',
                kind: 'rename',
            }),
            expect.any(Number),
            expect.any(Number),
            expect.any(Object),
            'rename-request',
            false,
        );
    });

    it('does not turn a nullable unchanged description into a definition update', async () => {
        load.mockResolvedValueOnce({
            ...(await load()),
            tokenDefinitionsByName: {
                accent: {
                    id: 'token-1',
                    designSystemId: 'ds-1',
                    name: 'accent',
                    type: 'color',
                    displayName: 'Accent',
                    description: null,
                    enabled: true,
                },
            },
        });
        const valueOnlyToken = { ...token, getDescription: () => undefined } as unknown as Token;
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() => updateDraftToken('System', '0.1.0', valueOnlyToken));
        await act(async () => vi.runAllTimersAsync());

        expect(saveTokenMutation.mock.calls[0][2].definitionPatch).toEqual({});
    });

    it('discards a delayed rename through the new token name', async () => {
        const renamedToken = {
            ...token,
            getName: () => 'accent-renamed',
            getTags: () => ['accent-renamed'],
            getDisplayName: () => 'Accent renamed',
        } as unknown as Token;
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() => renameDraftToken('System', '0.1.0', 'accent', renamedToken));
        act(() => updateDraftToken('System', '0.1.0', renamedToken, 'discard'));
        await act(async () => vi.runAllTimersAsync());

        expect(saveTokenMutation).not.toHaveBeenCalled();
    });

    it('does not confirm a new tenant draft when an old in-flight save finishes', async () => {
        let finishOldSave: ((value: Awaited<ReturnType<typeof saveTokenMutation>>) => void) | undefined;
        const oldSave = new Promise<Awaited<ReturnType<typeof saveTokenMutation>>>((resolve) => {
            finishOldSave = resolve;
        });
        saveTokenMutation.mockReturnValueOnce(oldSave);
        const secondContext = { ...context, tenantId: 'tenant-2' };
        const { rerender } = render(<ProbeWithContext editorContext={context} />);
        await act(async () => Promise.resolve());

        act(() => updateDraftToken('System', '0.1.0', token));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
        });
        expect(saveTokenMutation).toHaveBeenCalledOnce();

        rerender(<ProbeWithContext editorContext={secondContext} />);
        await act(async () => Promise.resolve());
        act(() => updateDraftToken('System', '0.1.0', token));
        const secondDraftKey = getDraftKey('System', '0.1.0', secondContext);
        expect(localStorage.getItem(secondDraftKey)).toContain('#123456');

        await act(async () => {
            finishOldSave?.({
                tokenId: 'token-1',
                editRevision: 4,
                baseRevision: 5,
                valueBaseRevisions: {},
            });
            await oldSave;
            await Promise.resolve();
        });

        expect(localStorage.getItem(secondDraftKey)).toContain('#123456');
        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).toBeNull();
    });

    it('does not remove a newer change of the same token when the old request finishes', async () => {
        let finishFirstSave: ((value: Awaited<ReturnType<typeof saveTokenMutation>>) => void) | undefined;
        const firstSave = new Promise<Awaited<ReturnType<typeof saveTokenMutation>>>((resolve) => {
            finishFirstSave = resolve;
        });
        saveTokenMutation.mockReturnValueOnce(firstSave);
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() => updateDraftToken('System', '0.1.0', token));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
        });
        const newerToken = { ...token, getValue: () => '#654321' } as unknown as Token;
        act(() => updateDraftToken('System', '0.1.0', newerToken));

        await act(async () => {
            finishFirstSave?.({
                tokenId: 'token-1',
                editRevision: 4,
                baseRevision: 5,
                valueBaseRevisions: {},
            });
            await firstSave;
            await Promise.resolve();
        });

        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).toContain('#654321');
        await act(async () => {
            await vi.runAllTimersAsync();
            await Promise.resolve();
        });
        expect(saveTokenMutation).toHaveBeenCalledTimes(2);
        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).toBeNull();
    });

    it('flushes a delayed operation with keepalive when the editor unmounts', async () => {
        const view = render(<Probe />);
        await act(async () => Promise.resolve());
        act(() => updateDraftToken('System', '0.1.0', token));

        view.unmount();
        await act(async () => Promise.resolve());

        expect(saveTokenMutation).toHaveBeenCalledWith(
            context,
            'token-1',
            expect.objectContaining({ tokenName: 'accent' }),
            3,
            0,
            expect.any(Object),
            expect.any(String),
            true,
        );
    });
});

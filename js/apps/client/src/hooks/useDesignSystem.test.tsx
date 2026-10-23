import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { load, loadDesignSystemCursor, loadTokenData, loadComponentData, loadComponentIndex, saveTokenMutation } =
    vi.hoisted(() => ({
        load: vi.fn(),
        loadDesignSystemCursor: vi.fn(),
        loadTokenData: vi.fn(),
        loadComponentData: vi.fn(),
        loadComponentIndex: vi.fn(),
        saveTokenMutation: vi.fn(),
    }));
const { subscribeToDraftInvalidations, emitDraftInvalidation } = vi.hoisted(() => {
    let received: ((event: Record<string, unknown>) => void) | undefined;
    return {
        subscribeToDraftInvalidations: vi.fn(({ received: next }) => {
            received = next;
            return Promise.resolve();
        }),
        emitDraftInvalidation: (event: Record<string, unknown>) => received?.(event),
    };
});
const { applyDraftChanges } = vi.hoisted(() => ({
    applyDraftChanges: vi.fn(),
}));

vi.mock('../api/themeEditorRepository', () => ({
    loadThemeEditor: load,
    loadThemeShell: load,
    loadDesignSystemCursor,
}));
vi.mock('../api/tokenRepository', () => ({
    tokenRepository: { loadTokenData, loadColorGroups: async () => [], saveTokenMutation },
}));
vi.mock('../api/componentRepository', () => ({
    componentRepository: { loadComponentData, loadComponentIndex, loadComposeComponentData: async () => [] },
}));
vi.mock('../api/draftInvalidationStream', () => ({ subscribeToDraftInvalidations }));
vi.mock('../utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../utils')>()),
    applyDraftChanges,
}));

vi.mock('../controllers', () => ({
    DesignSystem: {
        fromSnapshot: () => ({
            createThemeInstance: () => ({ getToken: () => undefined, addToken: vi.fn() }),
            createAllComponentInstances: () => [],
            createAllComposeComponentInstances: () => [],
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
import type { DraftChangeDto } from '../api/editorContracts';
import { recordDraftSave, setDraftAutosaveActivity } from '../api/draftAutosaveActivity';
import { reportIncompleteMutationMetadata } from '../api/incompleteMutationMetadata';
import { getPaletteSession, paletteRepository } from '../palette/paletteSession';
import { getActivePalette } from '../palette/activePalette';
import type { ThemePalette } from '../modules/palette';
import type { EditorSection } from '../features/themeEditor/editorSections';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };

describe('согласованная загрузка целых разделов', () => {
    it('первое чтение не застревает из-за цветовой очереди, оставшейся с ошибкой', async () => {
        setDraftAutosaveActivity(context, 'color-tokens', 'error');
        try {
            const { result } = renderHook(() => useDesignSystem(context, true, { section: 'colors' }));
            await act(async () => Promise.resolve());
            expect(result.current.sectionLoading).toBe(false);
            expect(loadTokenData).toHaveBeenCalledTimes(1);
            expect(applyDraftChanges).toHaveBeenCalledTimes(2); // shell + initial typed snapshot for session recovery
        } finally {
            setDraftAutosaveActivity(context, 'color-tokens', null);
        }
    });
    it.each(['colors', 'palette'] as const)(
        'строит local-палитру из применённых цветов при прямом открытии %s',
        async (section) => {
            const source = paletteRepository.source;
            const palette = { tenantId: context.tenantId, groups: [] } as unknown as ThemePalette;
            const loadPalette = vi.spyOn(paletteRepository, 'load').mockImplementation(async () => {
                expect(getPaletteSession()?.tokens).toContainEqual({
                    id: 'token-1',
                    name: 'accent',
                    displayName: 'Accent',
                });
                return palette;
            });
            Object.assign(paletteRepository, { source: 'local' });
            try {
                const { result } = renderHook(() => useDesignSystem(context, true, { section }));
                await act(async () => Promise.resolve());
                expect(result.current.palette).toBe(palette);
                expect(getActivePalette()).toBe(palette);
                expect(loadPalette).toHaveBeenCalledTimes(1);
                expect(loadTokenData).toHaveBeenCalledExactlyOnceWith(context, expect.any(AbortSignal), '0.1.0', [
                    'color',
                    'gradient',
                ]);
                act(() => updateDraftToken('System', '0.1.0', token));
                await act(async () => vi.advanceTimersByTimeAsync(400));
                expect(saveTokenMutation).toHaveBeenCalledTimes(1);
                expect(saveTokenMutation.mock.calls[0][1]).toBe('token-1');
            } finally {
                Object.assign(paletteRepository, { source });
                loadPalette.mockRestore();
            }
        },
    );
    it('не пересоздаёт компонентный снимок по saved/cleanup уведомлениям эффекта автосохранения', async () => {
        let subscriptions = 0;
        const Probe = () => {
            const state = useDesignSystem(context, true, { section: 'components' });
            useEffect(() => {
                if (!state.designSystem) return;
                subscriptions++;
                if (subscriptions > 5) throw new Error('Component autosave feedback loop');
                setDraftAutosaveActivity(context, 'component:A', 'saved');
                return () => setDraftAutosaveActivity(context, 'component:A', null);
            }, [state.designSystem, state.components]);
            return null;
        };
        render(<Probe />);
        await act(async () => Promise.resolve());
        const settled = subscriptions;
        await act(async () => {
            setDraftAutosaveActivity(context, 'component:A', null);
            setDraftAutosaveActivity(context, 'component:A', 'saved');
        });
        expect(subscriptions).toBe(settled);
        expect(loadComponentIndex).toHaveBeenCalledTimes(1);
    });
    it('подтверждение собственной записи инвалидирует кэш, но не читает скрытые разделы', async () => {
        const { rerender } = renderHook(
            ({ section }: { section: EditorSection }) => useDesignSystem(context, true, { section }),
            { initialProps: { section: 'colors' as EditorSection } },
        );
        await act(async () => Promise.resolve());
        rerender({ section: 'settings' });
        await act(async () => Promise.resolve());
        loadTokenData.mockClear();
        await act(async () => recordDraftSave(context));
        expect(loadTokenData).not.toHaveBeenCalled();
        rerender({ section: 'colors' });
        await act(async () => Promise.resolve());
        expect(loadTokenData).toHaveBeenCalledTimes(1);
    });

    it('не применяет позднее чтение, если запись целиком завершилась за время GET', async () => {
        let release!: (value: unknown) => void;
        const fresh = await loadTokenData();
        loadTokenData.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    release = resolve;
                }),
        );
        const { result } = renderHook(() => useDesignSystem(context, true, { section: 'colors' }));
        await act(async () => Promise.resolve());
        await act(async () => {
            setDraftAutosaveActivity(context, 'color-tokens', 'saving');
            setDraftAutosaveActivity(context, 'color-tokens', 'saved');
            release(fresh);
        });
        expect(result.current.sectionLoading).toBe(false);
        expect(loadTokenData).toHaveBeenCalledTimes(3); // fixture + discarded read + fresh read
        setDraftAutosaveActivity(context, 'color-tokens', null);
    });

    it('восстанавливает реальные скрытые правки с серверными идентификаторами при входе в настройки', async () => {
        setActiveDraftContext(context);
        updateDraftToken('System', '0.1.0', token);
        renderHook(() => useDesignSystem(context, true, { section: 'settings' }));
        await act(async () => vi.advanceTimersByTimeAsync(400));
        expect(loadTokenData).toHaveBeenCalledWith(context, expect.any(AbortSignal), '0.1.0', ['color', 'gradient']);
        expect(saveTokenMutation).toHaveBeenCalledTimes(1);
        expect(saveTokenMutation.mock.calls[0][1]).toBe('token-1');
    });
    it('открывает цвета без компонентов и меняет раздел без пересоздания сессии', async () => {
        const { result, rerender } = renderHook(
            ({ section }: { section: EditorSection }) => useDesignSystem(context, true, { section }),
            { initialProps: { section: 'colors' as EditorSection } },
        );
        await act(async () => Promise.resolve());
        expect(result.current.sectionLoading).toBe(false);
        expect(loadTokenData).toHaveBeenCalledWith(context, expect.any(AbortSignal), '0.1.0', ['color', 'gradient']);
        expect(loadComponentData).not.toHaveBeenCalled();
        rerender({ section: 'shapes' });
        await act(async () => Promise.resolve());
        expect(loadTokenData).toHaveBeenLastCalledWith(context, expect.any(AbortSignal), '0.1.0', [
            'shape',
            'spacing',
            'shadow',
        ]);
        expect(load).toHaveBeenCalledTimes(1);
        expect(subscribeToDraftInvalidations).toHaveBeenCalledTimes(1);
        rerender({ section: 'colors' });
        await act(async () => Promise.resolve());
        expect(loadTokenData).toHaveBeenCalledTimes(2);
    });

    it('не читает скрытые цвета по SSE, но обновляет их при возвращении', async () => {
        const { rerender } = renderHook(
            ({ section }: { section: EditorSection }) => useDesignSystem(context, true, { section }),
            { initialProps: { section: 'colors' as EditorSection } },
        );
        await act(async () => Promise.resolve());
        rerender({ section: 'settings' });
        await act(async () => Promise.resolve());
        loadTokenData.mockClear();
        await act(async () => emitDraftInvalidation({ draftId: 'draft-1', scopes: ['theme-tokens'] }));
        expect(loadTokenData).not.toHaveBeenCalled();
        expect(loadComponentData).not.toHaveBeenCalled();
        rerender({ section: 'colors' });
        await act(async () => Promise.resolve());
        expect(loadTokenData).toHaveBeenCalledTimes(1);
    });

    it('ошибка независимой компонентной очереди не блокирует обновление цветов', async () => {
        renderHook(() => useDesignSystem(context, true, { section: 'colors' }));
        await act(async () => Promise.resolve());
        loadTokenData.mockClear();
        await act(async () => {
            setDraftAutosaveActivity(context, 'component:Other', 'error');
            emitDraftInvalidation({ draftId: 'draft-1', scopes: ['theme-tokens'] });
        });
        expect(loadTokenData).toHaveBeenCalledTimes(1);
        setDraftAutosaveActivity(context, 'component:Other', null);
    });

    it('уход в настройки сохраняет очередь и серверную идентичность отложенной цветовой правки', async () => {
        const { rerender } = renderHook(
            ({ section }: { section: EditorSection }) => useDesignSystem(context, true, { section }),
            { initialProps: { section: 'colors' as EditorSection } },
        );
        await act(async () => Promise.resolve());
        act(() => updateDraftToken('System', '0.1.0', token));
        rerender({ section: 'settings' });
        await act(async () => vi.advanceTimersByTimeAsync(400));
        expect(saveTokenMutation).toHaveBeenCalledTimes(1);
        expect(saveTokenMutation.mock.calls[0][1]).toBe('token-1');
    });
});
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
    const tokenData = {
        tenant: { id: 'tenant-1', designSystemId: 'ds-1', name: 'Theme' },
        themeData: { meta: { tokens: [] }, variations: {} },
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
    };
    load.mockReset().mockResolvedValue({
        ...tokenData,
        designSystem: { id: 'ds-1', name: 'System', draftId: 'draft-1', draftRevision: 1 },
        componentsData: [],
        parameters: { draftId: 'draft-1', draftRevision: 1 },
    });
    loadTokenData.mockReset().mockResolvedValue(tokenData);
    loadDesignSystemCursor
        .mockReset()
        .mockResolvedValue({ id: 'ds-1', name: 'System', draftId: 'draft-1', draftRevision: 2 });
    loadComponentData.mockReset().mockResolvedValue([]);
    loadComponentIndex.mockReset().mockResolvedValue([]);
    subscribeToDraftInvalidations.mockClear();
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
    it('перечитывает неполные метаданные только после подтверждения всех очередей без пересоздания компонентов', async () => {
        const { result, unmount } = renderHook(() => useDesignSystem(context));
        await act(async () => Promise.resolve());
        const components = result.current.components;
        setDraftAutosaveActivity(context, 'palette', 'saving');
        setDraftAutosaveActivity(context, 'components', 'pending');
        await act(async () => {
            reportIncompleteMutationMetadata({
                headers: { 'x-ds-mutation-metadata-truncated': 'true' },
                config: { url: '/api/projects/project-1/ds/tenants/tenant-1/color-tokens' },
            });
            setDraftAutosaveActivity(context, 'palette', 'saved');
        });
        expect(loadTokenData).not.toHaveBeenCalled();
        await act(async () => {
            setDraftAutosaveActivity(context, 'components', 'saved');
        });
        expect(loadTokenData).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledTimes(1);
        expect(loadComponentData).not.toHaveBeenCalled();
        expect(result.current.components).toBe(components);
        setDraftAutosaveActivity(context, 'palette', null);
        setDraftAutosaveActivity(context, 'components', null);
        unmount();
        reportIncompleteMutationMetadata({
            headers: { 'x-ds-mutation-metadata-truncated': 'true' },
            config: { url: '/api/projects/project-1/ds/tenants/tenant-1/color-tokens' },
        });
        expect(loadTokenData).toHaveBeenCalledTimes(1);
    });
    it('не применяет старый ответ, если другая очередь успела сохраниться во время чтения', async () => {
        const { result } = renderHook(() => useDesignSystem(context));
        await act(async () => Promise.resolve());
        const previousTheme = result.current.theme;
        const tokenData = await loadTokenData();
        loadTokenData.mockClear();
        let resolveOld!: (value: unknown) => void;
        loadTokenData.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveOld = resolve;
                }),
        );
        let refresh!: Promise<void>;
        await act(async () => {
            refresh = result.current.refreshChanges([{ entityType: 'token-value' } as DraftChangeDto]);
        });
        expect(loadTokenData).toHaveBeenCalledTimes(1);
        await act(async () => {
            setDraftAutosaveActivity(context, 'components', 'pending');
            setDraftAutosaveActivity(context, 'components', 'saved');
            resolveOld(tokenData);
            await refresh;
        });
        setDraftAutosaveActivity(context, 'components', null);
        expect(loadTokenData).toHaveBeenCalledTimes(2);
        expect(result.current.theme).not.toBe(previousTheme);
    });
    it('сохраняет local-палитру при обновлении токенов после отмены', async () => {
        const source = paletteRepository.source;
        const palette = { tenantId: context.tenantId, groups: [] } as unknown as ThemePalette;
        const loadPalette = vi.spyOn(paletteRepository, 'load').mockResolvedValue(palette);
        Object.assign(paletteRepository, { source: 'local' });
        try {
            const { result } = renderHook(() => useDesignSystem(context));
            await act(async () => Promise.resolve());
            expect(result.current.palette).toBe(palette);
            await act(async () => {
                await result.current.refreshChanges([{ entityType: 'token-value' } as DraftChangeDto]);
            });
            expect(result.current.palette).toBe(palette);
            expect(getActivePalette()).toBe(palette);
            expect(loadTokenData).toHaveBeenCalledTimes(1);
        } finally {
            Object.assign(paletteRepository, { source });
            loadPalette.mockRestore();
        }
    });
    it.each(['token-value', 'palette-step', 'palette-ramp', 'palette-group', 'palette-token-group', 'token-group'])(
        'явно обновляет %s после отмены без SSE, полной загрузки и пересоздания компонентов',
        async (entityType) => {
            const { result } = renderHook(() => useDesignSystem(context));
            await act(async () => Promise.resolve());
            const previousTheme = result.current.theme;
            const previousComponents = result.current.components;
            await act(async () => {
                await result.current.refreshChanges([{ entityType } as DraftChangeDto]);
            });
            expect(load).toHaveBeenCalledTimes(1);
            expect(loadTokenData).toHaveBeenCalledWith(context, expect.any(AbortSignal), '0.1.0');
            expect(result.current.theme).not.toBe(previousTheme);
            expect(result.current.components).toBe(previousComponents);
            expect(loadComponentData).not.toHaveBeenCalled();
        },
    );
    it('после revert ждёт подтверждения другой локальной очереди перед обновлением', async () => {
        const { result } = renderHook(() => useDesignSystem(context));
        await act(async () => Promise.resolve());
        setDraftAutosaveActivity(context, 'components', 'pending');
        let refresh!: Promise<void>;
        await act(async () => {
            refresh = result.current.refreshChanges([{ entityType: 'token-value' } as DraftChangeDto]);
        });
        expect(loadTokenData).not.toHaveBeenCalled();
        await act(async () => {
            setDraftAutosaveActivity(context, 'components', 'saved');
            await refresh;
        });
        setDraftAutosaveActivity(context, 'components', null);
        expect(loadTokenData).toHaveBeenCalledTimes(1);
    });
    it('reloads only token data for a token invalidation without rebuilding the full snapshot', async () => {
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() =>
            emitDraftInvalidation({
                designSystemId: 'ds-1',
                draftId: 'draft-1',
                draftRevision: 2,
                actorId: 'user-2',
                clientId: 'tab-2',
                changedAt: '2026-10-15T13:30:00Z',
                scopes: ['theme-tokens'],
            }),
        );
        await act(async () => Promise.resolve());

        expect(screen.getByText('loaded')).toBeInTheDocument();
        expect(load).toHaveBeenCalledTimes(1);
        expect(loadTokenData).toHaveBeenCalledOnce();
        expect(loadComponentData).not.toHaveBeenCalled();
    });

    it('reloads only component data for a component invalidation', async () => {
        render(<Probe />);
        await act(async () => Promise.resolve());

        act(() =>
            emitDraftInvalidation({
                designSystemId: 'ds-1',
                draftId: 'draft-1',
                draftRevision: 2,
                actorId: 'user-2',
                clientId: 'tab-2',
                changedAt: '2026-10-15T13:30:00Z',
                scopes: ['component-configurations'],
            }),
        );
        await act(async () => Promise.resolve());

        expect(screen.getByText('loaded')).toBeInTheDocument();
        expect(load).toHaveBeenCalledTimes(1);
        expect(loadTokenData).not.toHaveBeenCalled();
        expect(loadComponentData).toHaveBeenCalledOnce();
    });

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

    it('восстанавливает точные параметры первого запроса после потери ответа и чужого сохранения', async () => {
        saveTokenMutation.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
        const editor = render(<Probe />);
        await act(async () => Promise.resolve());
        act(() => updateDraftToken('System', '0.1.0', token));
        await act(async () => vi.advanceTimersByTimeAsync(400));
        expect(saveTokenMutation).toHaveBeenCalledOnce();
        const original = structuredClone(saveTokenMutation.mock.calls[0].slice(1, 7));
        const metadata = JSON.parse(localStorage.getItem('ds_pending_meta:project-1:ds-1:tenant-1:accent')!);
        expect(metadata.request).toMatchObject({ tokenId: 'token-1', editRevision: 3 });
        editor.unmount();

        const snapshot = await load();
        load.mockResolvedValue({
            ...snapshot,
            editRevision: 90,
            tokenValueRevisionsByKey: { 'token-1:web:': 80, 'token-1:ios:': 81, 'token-1:android:': 82 },
            tokenDefinitionsByName: {
                ...snapshot.tokenDefinitionsByName,
                accent: { ...snapshot.tokenDefinitionsByName.accent, description: 'Изменено другим пользователем' },
            },
        });
        render(<Probe />);
        await act(async () => Promise.resolve());
        await act(async () => vi.advanceTimersByTimeAsync(400));
        expect(saveTokenMutation).toHaveBeenCalledTimes(2);
        expect(saveTokenMutation.mock.calls[1].slice(1, 7)).toEqual(original);
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
            expect.any(AbortSignal),
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
            expect.any(AbortSignal),
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
        expect(saveTokenMutation.mock.calls[1][2]).toEqual(
            expect.objectContaining({ tokenName: 'accent', kind: 'create' }),
        );
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
        expect(saveTokenMutation.mock.calls[1][2]).toEqual(
            expect.objectContaining({ tokenName: 'accent', kind: 'create' }),
        );
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
            expect.any(AbortSignal),
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
        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).toContain('#123456');
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

    it('does not remove recovery data of a newer session in the same tenant', async () => {
        let finish!: (value: unknown) => void;
        saveTokenMutation.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const first = render(<Probe />);
        await act(async () => Promise.resolve());
        act(() => updateDraftToken('System', '0.1.0', token));
        await act(async () => vi.advanceTimersByTimeAsync(400));
        first.unmount();
        render(<Probe />);
        await act(async () => Promise.resolve());
        act(() =>
            updateDraftToken('System', '0.1.0', {
                ...token,
                getValue: () => '#654321',
            } as unknown as Token),
        );
        await act(async () => {
            finish({ tokenId: 'token-1', editRevision: 4, baseRevision: 5, valueBaseRevisions: {} });
            await Promise.resolve();
        });
        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).toContain('#654321');
    });

    it('recovers a delete whose committed entity is absent without deleting its replacement', async () => {
        let finish!: (value: unknown) => void;
        saveTokenMutation.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const first = render(<Probe />);
        await act(async () => Promise.resolve());
        act(() => updateDraftToken('System', '0.1.0', token, 'remove'));
        await act(async () => vi.advanceTimersByTimeAsync(400));
        first.unmount();
        const snapshot = await load();
        load.mockResolvedValue({
            ...snapshot,
            tokenIdsByName: { accent: 'replacement' },
            tokenDefinitionsByName: { accent: { ...snapshot.tokenDefinitionsByName.accent, id: 'replacement' } },
        });
        render(<Probe />);
        await act(async () => {
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
        });
        expect(saveTokenMutation).toHaveBeenCalledTimes(2);
        // Повторяется исходное DELETE по id и ключу, а не удаление новой сущности с тем же именем.
        expect(saveTokenMutation.mock.calls[1].slice(1, 7)).toEqual(saveTokenMutation.mock.calls[0].slice(1, 7));
        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).toBeNull();
        await act(async () => {
            finish({ tokenId: 'token-1', editRevision: 4, baseRevision: 5, valueBaseRevisions: {} });
            await Promise.resolve();
        });
        act(() => updateDraftToken('System', '0.1.0', token));
        await act(async () => vi.advanceTimersByTimeAsync(400));
        expect(saveTokenMutation.mock.calls.at(-1)?.[1]).toBe('replacement');
    });

    it('retains a delayed operation for recovery without sending from a closed editor', async () => {
        const view = render(<Probe />);
        await act(async () => Promise.resolve());
        act(() => updateDraftToken('System', '0.1.0', token));

        view.unmount();
        await act(async () => Promise.resolve());

        await act(async () => vi.runAllTimersAsync());
        expect(saveTokenMutation).not.toHaveBeenCalled();
        expect(localStorage.getItem(getDraftKey('System', '0.1.0', context))).not.toBeNull();
    });
});

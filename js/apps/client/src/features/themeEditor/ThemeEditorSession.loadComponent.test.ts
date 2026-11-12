import { expect, it, vi } from 'vitest';

import type { ThemeEditorSnapshot } from '../../api/editorContracts';
import { renameDraftToken, updateDraftToken, setActiveDraftContext } from '../../utils/designSystemDraft';
import { tokenRepository } from '../../api/tokenRepository';
import type { Token } from '../../controllers';
import type { EditorSectionData } from './EditorSectionData';
import { ThemeEditorSession } from './ThemeEditorSession';

const context = { projectId: 'session-scope', designSystemId: 'ds', tenantId: 'theme' };

const snapshot = (): ThemeEditorSnapshot =>
    ({
        editRevision: 0,
        tokenIdsByName: {},
        componentsData: [],
        composeComponentsData: [],
    }) as unknown as ThemeEditorSnapshot;

const sessionWith = (onSnapshot = vi.fn()) => {
    const sections = {
        activeSection: 'colors',
        invalidate: vi.fn(),
        activate: vi.fn().mockResolvedValue(undefined),
        refreshAddressedColors: vi.fn().mockResolvedValue(false),
        loadComponent: vi.fn(async (component?: string) => ({
            snapshot: snapshot(),
            tokensChanged: false,
            componentsChanged: true,
            tokenTypes: [],
            activityRevision: 0,
            component,
        })),
    } as unknown as EditorSectionData;
    const session = new ThemeEditorSession({
        context,
        snapshot: snapshot(),
        signal: new AbortController().signal,
        sections,
        onSaved: vi.fn(),
        onStatus: vi.fn(),
        onSnapshot,
        onDisposed: vi.fn(),
    });
    return { session, onSnapshot, sections };
};

it('помечает снимок чтения краткого списка компонентов как index', async () => {
    const { session, onSnapshot } = sessionWith();

    await session.loadComponent();

    expect(onSnapshot).toHaveBeenCalledWith(expect.anything(), false, true, 'index');
});

it('помечает снимок полного чтения компонента как full', async () => {
    const { session, onSnapshot } = sessionWith();

    await session.loadComponent('Accordion');

    expect(onSnapshot).toHaveBeenCalledWith(expect.anything(), false, true, 'full');
});


it('неизвестный результат POST выбирает общую сверку без адресного GET', async () => {
    const { session, sections } = sessionWith();
    await session.refreshChanges([{ entityType: 'token-value', entityId: 'attempted' }], { outcome: 'unknown' });
    expect(sections.refreshAddressedColors).not.toHaveBeenCalled();
    expect(sections.invalidate).toHaveBeenCalledWith(new Set(['all']), undefined);
    expect(sections.activate).toHaveBeenCalledOnce();
});


it('адресная сверка сохраняет pending rename и привязку следующего ввода до ACK', async () => {
    vi.useFakeTimers();
    localStorage.clear();
    const renamed = {
        getName: () => 'light.accent-new', getType: () => 'color', getValue: () => '#123456',
        getDescription: () => '', getEnabled: () => true, getTags: () => ['light', 'accent-new'],
        getDisplayName: () => 'Accent',
    } as unknown as Token;
    const { session, sections } = sessionWith();
    // Начальный снимок с устойчивым ID; последующее чтение не должно сбрасывать runtime-переименование.
    const seed = {
        ...snapshot(), designSystem: { name: 'System' }, parameters: {},
        tokenIdsByName: { accent: 'token-1' },
        tokenDefinitionsByName: { accent: { id: 'token-1', name: 'accent', type: 'color', editRevision: 0 } },
    } as unknown as ThemeEditorSnapshot;
    const controller = new AbortController();
    const scoped = new ThemeEditorSession({
        context, snapshot: seed, signal: controller.signal, sections,
        onSaved: vi.fn(), onStatus: vi.fn(), onSnapshot: vi.fn(), onDisposed: vi.fn(),
    });
    const saves = vi.spyOn(tokenRepository, 'saveTokenMutation').mockResolvedValue({
        tokenId: 'token-1', editRevision: 1, baseRevision: 1, valueBaseRevisions: {},
    });
    const addressed = vi.spyOn(sections, 'refreshAddressedColors').mockImplementation(async (_changes, pending) => {
        expect(pending?.('color')).toBe(true);
        return false;
    });
    try {
        setActiveDraftContext(context);
        scoped.start();
        renameDraftToken('System', '0.1.0', 'light.accent', renamed);
        await scoped.refreshChanges([{ entityType: 'token-value', entityId: 'other-value' }]);
        updateDraftToken('System', '0.1.0', { ...renamed, getValue: () => '#abcdef' } as unknown as Token);
        await vi.advanceTimersByTimeAsync(401);
        expect(addressed).toHaveBeenCalledOnce();
        expect(saves).toHaveBeenCalledTimes(1);
        expect(saves.mock.calls[0][1]).toBe('token-1');
        expect(saves.mock.calls[0][2]).toMatchObject({ tokenName: 'light.accent-new', definitionPatch: { name: 'accent-new' }, change: { values: { web: '#abcdef' } } });
    } finally {
        controller.abort();
        scoped.dispose();
        session.dispose();
        setActiveDraftContext(null);
        saves.mockRestore();
        vi.useRealTimers();
    }
});

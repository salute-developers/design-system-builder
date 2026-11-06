import { expect, it, vi } from 'vitest';

import type { ThemeEditorSnapshot } from '../../api/editorContracts';
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
    return { session, onSnapshot };
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

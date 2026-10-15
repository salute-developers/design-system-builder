import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Token } from '../controllers';
import {
    draftEntriesOfTypes,
    getDraftKey,
    removeDraftEntries,
    setActiveDraftContext,
    confirmDraftToken,
    setPendingMutationListener,
    updateDraftToken,
} from './designSystemDraft';

const token = {
    getName: () => 'accent',
    getType: () => 'color',
    getValue: () => '#123456',
    getDescription: () => undefined,
    getEnabled: () => true,
} as unknown as Token;

beforeEach(() => {
    localStorage.clear();
    setPendingMutationListener(null);
});

describe('tenant-aware drafts', () => {
    it('isolates the same token changes by project, design system and tenant', () => {
        setActiveDraftContext({ projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' });
        const first = getDraftKey('ignored', 'ignored');
        updateDraftToken('ignored', 'ignored', token);
        setActiveDraftContext({ projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-2' });
        const second = getDraftKey('ignored', 'ignored');
        expect(first).toBe('ds_draft:project-1:ds-1:tenant-1');
        expect(second).toBe('ds_draft:project-1:ds-1:tenant-2');
        expect(localStorage.getItem(first)).toContain('#123456');
        expect(localStorage.getItem(second)).toBeNull();
    });

    it('keeps only an unconfirmed request and removes it after server confirmation', () => {
        const listener = vi.fn();
        setActiveDraftContext({ projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' });
        setPendingMutationListener(listener);
        updateDraftToken('System', '0.1.0', token);
        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({ tokenName: 'accent', kind: 'update', context: expect.any(Object) }),
        );
        expect(localStorage.getItem(getDraftKey('System', '0.1.0'))).toContain('#123456');
        confirmDraftToken('System', '0.1.0', 'accent');
        expect(localStorage.getItem(getDraftKey('System', '0.1.0'))).toBeNull();
    });

    it('keeps deletion recoverable while discard only removes a pending edit', () => {
        const listener = vi.fn();
        setActiveDraftContext({ projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' });
        setPendingMutationListener(listener);

        updateDraftToken('System', '0.1.0', token, 'remove');
        expect(localStorage.getItem(getDraftKey('System', '0.1.0'))).toContain('"deleted":true');
        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'delete', tokenName: 'accent' }));

        updateDraftToken('System', '0.1.0', token, 'discard');
        expect(localStorage.getItem(getDraftKey('System', '0.1.0'))).toBeNull();
        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'discard', change: null }));
    });
});

describe('цветовые записи прежнего черновика', () => {
    const named = (name: string, type: string) => ({ ...token, getName: () => name, getType: () => type }) as unknown as Token;

    it('находит записи цветов и градиентов и удаляет только их', () => {
        setActiveDraftContext({ projectId: 'p', designSystemId: 'ds', tenantId: 't' });
        updateDraftToken('', '', named('dark.text.default.accent', 'color'));
        updateDraftToken('', '', named('light.surface.default.accent-gradient', 'gradient'));
        updateDraftToken('', '', named('screen-s.body.m', 'typography'));

        const entries = draftEntriesOfTypes('', '', ['color', 'gradient']);
        expect(entries).toEqual([
            { name: 'dark.text.default.accent', type: 'color' },
            { name: 'light.surface.default.accent-gradient', type: 'gradient' },
        ]);

        removeDraftEntries('', '', entries.map((entry) => entry.name));
        expect(draftEntriesOfTypes('', '', ['color', 'gradient'])).toEqual([]);
        expect(localStorage.getItem(getDraftKey('', ''))).toContain('screen-s.body.m');
    });

    it('удаляет черновик целиком, когда записей не осталось', () => {
        setActiveDraftContext({ projectId: 'p', designSystemId: 'ds', tenantId: 't2' });
        updateDraftToken('', '', named('dark.text.default.accent', 'color'));
        removeDraftEntries('', '', ['dark.text.default.accent']);
        expect(localStorage.getItem(getDraftKey('', ''))).toBeNull();
    });
});

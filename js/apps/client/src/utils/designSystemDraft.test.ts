import { beforeEach, describe, expect, it } from 'vitest';
import type { Token } from '../controllers';
import { getDraftKey, setActiveDraftContext, updateDraftToken } from './designSystemDraft';

const token = {
    getName: () => 'accent',
    getType: () => 'color',
    getValue: () => '#123456',
    getDescription: () => undefined,
    getEnabled: () => true,
} as unknown as Token;

beforeEach(() => localStorage.clear());

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
});

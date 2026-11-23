import { describe, expect, it, vi } from 'vitest';
vi.mock('./editorReads', () => ({ invalidateEditorReads: vi.fn() }));
import { invalidateEditorReads } from './editorReads';
import { componentCoreSelectionRevision, requireSameCoreSelectionRevision } from './componentCoreContext';
const context = { projectId: 'p', designSystemId: 'd', tenantId: 't' };
const response = (revision: number) => ({
    headers: { 'x-ds-read-context': JSON.stringify({ coreSelectionRevision: revision }) },
});
describe('model Core selection revision', () => {
    it('keeps the revision of the response that produced the model', () => {
        const old = componentCoreSelectionRevision(response(1));
        componentCoreSelectionRevision(response(2));
        expect(old).toBe(1);
        expect(componentCoreSelectionRevision({ data: [] })).toBeUndefined();
    });
    it('rejects mixed selections even if release coordinates returned to A', () => {
        expect(() => requireSameCoreSelectionRevision(context, [response(1), response(3)])).toThrow('Core изменился');
        expect(invalidateEditorReads).toHaveBeenCalledWith(context, { includeMetadata: true });
        expect(requireSameCoreSelectionRevision(context, [response(3), response(3)])).toBe(3);
    });
});

import { describe, expect, it, vi } from 'vitest';
const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock('./editorReads', () => ({ invalidateEditorReads: invalidate }));
import { componentCoreRelease, requireSameComponentCore } from './componentCoreContext';

const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };
describe('component Core provenance', () => {
    it('uses the platform release from the same read as the model', () => {
        expect(componentCoreRelease({ headers: { 'x-ds-read-context': JSON.stringify({ coreReleases: [
            { platform: 'web', releaseId: 'web-A' }, { platform: 'compose', releaseId: 'compose-B' },
        ] }) } }, 'compose')).toBe('compose-B');
    });
    it('invalidates metadata and rejects mixed releases instead of constructing a mixed model', () => {
        expect(() => requireSameComponentCore(context, ['A', undefined, 'B'])).toThrow('Core изменился');
        expect(invalidate).toHaveBeenCalledWith(context);
        expect(requireSameComponentCore(context, ['B', 'B'])).toBe('B');
    });
});

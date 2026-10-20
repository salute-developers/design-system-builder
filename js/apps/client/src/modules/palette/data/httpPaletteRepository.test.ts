import { beforeEach, describe, expect, it, vi } from 'vitest';
const { post, patch, get } = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), get: vi.fn() }));
vi.mock('../../../api/http', () => ({ http: { post, patch, get } }));
vi.mock('../../../api/editorReads', () => ({
    invalidateEditorReads: vi.fn(),
    readEditor: (...args: unknown[]) => get(...args),
}));
import { getDraftAutosaveRevision, isDraftAutosaveIdle } from '../../../api/draftAutosaveActivity';
import { createHttpPaletteRepository } from './httpPaletteRepository';
import { observeSubjectAddresses } from '../../../api/subjectRevisions';

const context = { projectId: 'palette-http', designSystemId: 's', tenantId: 't' };
const slot = { type: 'general' as const, shade: 'red' };

describe('координация палитровых запросов', () => {
    beforeEach(() => vi.clearAllMocks());
    it('учитывает правку ступени до подтверждения ответа', async () => {
        let finish!: (value: unknown) => void;
        patch.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const request = createHttpPaletteRepository().updateStep(context, 'g', slot, 500, '#123456', 0);
        expect(isDraftAutosaveIdle(context)).toBe(false);
        expect(patch.mock.calls[0][2].headers['X-DS-Base-Revision']).toBe('0');
        finish({ data: { editRevision: 0, value: {} } });
        await request;
        expect(isDraftAutosaveIdle(context)).toBe(true);
    });
    it('передаёт прочитанную редакцию конкретной ступени и принимает её подтверждение', async () => {
        const current = { ...context, tenantId: 'subject-step' };
        observeSubjectAddresses(current, 'palette', { 'step/g/general/red/500': 7, 'step/g/general/red/600': 12 });
        patch.mockResolvedValue({
            data: { editRevision: 0, value: {} },
            headers: {
                'x-ds-mutation-metadata': JSON.stringify([
                    { entityType: 'palette-step', entityId: 'step', revision: 8 },
                ]),
            },
        });
        const repository = createHttpPaletteRepository();
        await repository.updateStep(current, 'g', slot, 500, '#123456', 0);
        expect(patch.mock.calls[0][2].headers['X-DS-Base-Revision']).toBe('7');
        await repository.updateStep(current, 'g', slot, 500, '#654321', 0);
        expect(patch.mock.calls[1][2].headers['X-DS-Base-Revision']).toBe('8');
        await repository.updateStep(current, 'g', slot, 600, '#123456', 0);
        expect(patch.mock.calls[2][2].headers['X-DS-Base-Revision']).toBe('12');
    });
    it('предпросмотр и исторические связи не создают активность сохранения', async () => {
        const revision = getDraftAutosaveRevision(context);
        post.mockResolvedValue({ data: { steps: [] } });
        get.mockResolvedValue({ data: [] });
        const historical = { ...context, versionId: 'published' };
        const repository = createHttpPaletteRepository();
        await repository.rebuild(historical, 'g', slot, {
            anchorStep: 500,
            value: '#123456',
            preview: true,
            editRevision: 0,
        });
        await repository.links(historical, { slot });
        expect(post.mock.calls[0][2].params).toEqual({ versionId: 'published' });
        expect(get.mock.calls[0][1].params.versionId).toBe('published');
        expect(getDraftAutosaveRevision(context)).toBe(revision);
        expect(isDraftAutosaveIdle(context)).toBe(true);
    });
    it('блокирует историческую запись до отправки HTTP', async () => {
        await expect(
            createHttpPaletteRepository().updateStep(
                { ...context, versionId: 'published' },
                'g',
                slot,
                500,
                '#123456',
                0,
            ),
        ).rejects.toThrow();
        expect(patch).not.toHaveBeenCalled();
    });
});

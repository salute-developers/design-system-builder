import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/http', () => ({
    http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { http } from '../../../api/http';
import golden from '../fixtures/palette-golden.json';
import { isRebuildPreview, type PaletteMutation } from '../application/paletteRepository';
import { PaletteOperationError, type PaletteRamp, type PaletteTokenRef, type PaletteTokenValue } from '../domain';
import { createHttpPaletteRepository } from './httpPaletteRepository';
import { createLocalPaletteRepository, localPaletteKey, type LocalPaletteDeps } from './localPaletteRepository';
import { buildLocalTemplate } from './localTemplate';
import { paletteSourceFromEnv } from './createPaletteRepository';
import { restoreTemplateColor } from '../../../palette/activePalette';

const ctx = { projectId: 'p1', designSystemId: 'ds1', tenantId: 't1' };
const green = { type: 'general' as const, shade: 'green' };
const h190 = { type: 'additional' as const, shade: 'h190' };

const memoryStorage = () => {
    const items = new Map<string, string>();
    return {
        items,
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
    };
};

const setup = (canEdit = true) => {
    const storage = memoryStorage();
    let id = 0;
    const values = golden.scenario.values.map((value) => ({ ...value })) as PaletteTokenValue[];
    const applyRewrite = vi.fn<LocalPaletteDeps['applyRewrite']>();
    const repository = createLocalPaletteRepository({
        storage,
        newId: () => `id-${++id}`,
        template: () => golden.template,
        theme: () => ({ tokens: golden.scenario.tokens as PaletteTokenRef[], values, canEdit }),
        applyRewrite,
    });
    return { storage, repository, applyRewrite };
};

describe('адаптер local', () => {
    it('копирует шаблон при первом открытии и дальше использует копию', async () => {
        const { storage, repository } = setup();
        const palette = await repository.load(ctx);
        expect(palette.groups.map((group) => group.systemKey)).toEqual(['neutral', 'accent', 'status', 'data', 'syntax']);
        const saved = JSON.parse(storage.items.get(localPaletteKey(ctx))!);
        expect(saved.template['general.green']['500']).toBe(golden.template['general.green']['500']);
        const again = await repository.load(ctx);
        expect(again.groups.map((group) => group.id)).toEqual(palette.groups.map((group) => group.id));
    });

    it('палитры двух тем независимы', async () => {
        const { repository } = setup();
        const palette = await repository.load(ctx);
        const accent = palette.groups.find((group) => group.systemKey === 'accent')!;
        await repository.replaceSource(ctx, accent.id, green, h190, palette.editRevision);
        const other = await repository.load({ ...ctx, tenantId: 't2' });
        const otherAccent = other.groups.find((group) => group.systemKey === 'accent')!;
        expect(otherAccent.ramps[0].source).toEqual(green);
    });

    it('операции увеличивают ревизию и проверяют её', async () => {
        const { repository } = setup();
        const palette = await repository.load(ctx);
        const created = await repository.createGroup(ctx, 'Avatars', palette.editRevision);
        expect(created).toMatchObject({ editRevision: 1, value: { kind: 'custom', label: 'Avatars', ramps: [] } });
        await expect(repository.createGroup(ctx, 'Icons', palette.editRevision)).rejects.toMatchObject({
            code: 'TENANT_EDIT_CONFLICT',
            details: { editRevision: 1 },
        });
    });

    it('привязка токена, перестройка с превью, правка ступени и связи', async () => {
        const { repository } = setup();
        let palette = await repository.load(ctx);
        const group = await repository.createGroup(ctx, 'Avatars', palette.editRevision);
        const assigned = await repository.assignTokenGroup(ctx, 't1', group.value.id, group.editRevision);
        expect(assigned.value).toMatchObject({ groupId: group.value.id, assignment: 'explicit' });

        palette = await repository.load(ctx);
        const accent = palette.groups.find((item) => item.systemKey === 'accent')!;
        expect(accent.ramps).toEqual([]);
        const avatars = palette.groups.find((item) => item.id === group.value.id)!;
        const preview = await repository.rebuild(ctx, avatars.id, green, {
            anchorStep: 500,
            value: '#1F8A70',
            preview: true,
            editRevision: palette.editRevision,
        });
        expect(isRebuildPreview(preview) && preview.steps.find((step) => step.step === 500)?.value).toBe(
            golden.rebuild[0].expected['500'],
        );
        expect((await repository.load(ctx)).editRevision).toBe(palette.editRevision);

        const rebuilt = (await repository.rebuild(ctx, avatars.id, green, {
            anchorStep: 500,
            value: '#1F8A70',
            preview: false,
            editRevision: palette.editRevision,
        })) as PaletteMutation<PaletteRamp>;
        expect(rebuilt.value).toMatchObject({ origin: 'rebuild', displayName: 'Teal', modified: true });

        const edited = await repository.updateStep(ctx, avatars.id, green, 300, '#abcdef', rebuilt.editRevision);
        expect(edited.value.steps.find((step) => step.step === 300)).toMatchObject({ value: '#ABCDEF', overridden: true });

        const links = await repository.links(ctx, { slot: green, groupId: avatars.id });
        expect(links.map((link) => [link.tokenId, link.mode, link.step])).toEqual([
            ['t1', 'light', 500],
            ['t1', 'dark', 400],
        ]);
        expect(links[0].platforms).toEqual(['web', 'ios']);
    });

    it('удаление растяжки со связями пишет ссылки в черновик через applyRewrite', async () => {
        const { repository, applyRewrite } = setup();
        const palette = await repository.load(ctx);
        const accent = palette.groups.find((group) => group.systemKey === 'accent')!;
        await expect(repository.removeRamp(ctx, accent.id, green, { editRevision: 0 })).rejects.toMatchObject({
            code: 'PALETTE_RAMP_LINKED',
        });
        const removed = await repository.removeRamp(ctx, accent.id, green, { strategy: 'detach', editRevision: 0 });
        expect(removed).toEqual({ editRevision: 1, value: { reassigned: 2 } });
        const [, rewrite, resolveHex] = applyRewrite.mock.calls[0];
        expect(rewrite).toEqual({ tokenIds: ['t1'], from: green, to: 'detach' });
        expect(resolveHex(500)).toBe(golden.template['general.green']['500']);
    });

    it('ошибка записи палитры откатывает переписанные ссылки черновика и не меняет палитру', async () => {
        const { storage, repository, applyRewrite } = setup();
        await repository.load(ctx);
        const saved = storage.items.get(localPaletteKey(ctx));
        const undo = vi.fn();
        applyRewrite.mockReturnValue(undo);
        const original = storage.setItem;
        storage.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        const accent = (await repository.load(ctx)).groups.find((group) => group.systemKey === 'accent')!;
        await expect(repository.removeRamp(ctx, accent.id, green, { strategy: 'detach', editRevision: 0 })).rejects.toThrow(
            'QuotaExceededError',
        );
        expect(applyRewrite).toHaveBeenCalledTimes(1);
        expect(undo).toHaveBeenCalledTimes(1);
        storage.setItem = original;
        expect(storage.items.get(localPaletteKey(ctx))).toBe(saved);
    });

    it('ошибка переписывания ссылок не меняет палитру', async () => {
        const { storage, repository, applyRewrite } = setup();
        await repository.load(ctx);
        const saved = storage.items.get(localPaletteKey(ctx));
        applyRewrite.mockImplementation(() => {
            throw new Error('draft write failed');
        });
        const accent = (await repository.load(ctx)).groups.find((group) => group.systemKey === 'accent')!;
        await expect(repository.removeRamp(ctx, accent.id, green, { strategy: 'detach', editRevision: 0 })).rejects.toThrow(
            'draft write failed',
        );
        expect(storage.items.get(localPaletteKey(ctx))).toBe(saved);
    });

    it('переименование группы', async () => {
        const { repository } = setup();
        const palette = await repository.load(ctx);
        const created = await repository.createGroup(ctx, 'Новая группа', palette.editRevision);
        const renamed = await repository.renameGroup(ctx, created.value.id, 'Icons', created.editRevision);
        expect(renamed).toMatchObject({ editRevision: 2, value: { id: created.value.id, label: 'Icons', kind: 'custom' } });
    });

    it('без права изменения операции отклоняются', async () => {
        const { repository } = setup(false);
        const palette = await repository.load(ctx);
        expect(palette.canEdit).toBe(false);
        await expect(repository.createGroup(ctx, 'Avatars', 0)).rejects.toBeInstanceOf(PaletteOperationError);
    });

    it('шаблон local снимается с резолвера превью', () => {
        const template = buildLocalTemplate(restoreTemplateColor);
        expect(Object.keys(template)).toContain('general.green');
        expect(Object.keys(template)).toContain('additional.h190');
        expect(template['additional.h190']['500']).toBe(golden.template['additional.h190']['500']);
    });
});

describe('адаптер api', () => {
    const mocked = vi.mocked(http);
    beforeEach(() => vi.clearAllMocks());

    it('ходит по контракту палитры темы', async () => {
        const repository = createHttpPaletteRepository();
        mocked.get.mockResolvedValueOnce({ data: { tenantId: 't1' } });
        await repository.load(ctx);
        expect(mocked.get).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/palette', { signal: undefined });

        mocked.put.mockResolvedValueOnce({ data: { editRevision: 2, value: {} } });
        await repository.replaceSource(ctx, 'g-1', green, h190, 1);
        expect(mocked.put).toHaveBeenCalledWith(
            '/api/projects/p1/ds/tenants/t1/palette/groups/g-1/ramps/general/green/source',
            { type: 'additional', shade: 'h190', editRevision: 1 },
        );

        mocked.delete.mockResolvedValueOnce({ data: { editRevision: 3, value: { reassigned: 1 } } });
        await repository.removeRamp(ctx, 'g-1', green, { strategy: 'replace', replacement: h190, editRevision: 2 });
        expect(mocked.delete).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/palette/groups/g-1/ramps/general/green', {
            data: { strategy: 'replace', replacement: h190, editRevision: 2 },
        });
    });

    it('rebuild с preview: true возвращает ступени без ревизии', async () => {
        const repository = createHttpPaletteRepository();
        mocked.post.mockResolvedValueOnce({ data: { steps: [{ step: 500, value: '#1F8A70' }] } });
        const input = { anchorStep: 500, value: '#1F8A70', preview: true, editRevision: 4 };
        const result = await repository.rebuild(ctx, 'g-1', green, input);
        expect(mocked.post).toHaveBeenCalledWith(
            '/api/projects/p1/ds/tenants/t1/palette/groups/g-1/ramps/general/green/rebuild',
            input,
        );
        expect(isRebuildPreview(result) && result.steps).toEqual([{ step: 500, value: '#1F8A70' }]);
    });

    it('переименование группы — PATCH /groups/{groupId}', async () => {
        const repository = createHttpPaletteRepository();
        mocked.patch.mockResolvedValueOnce({ data: { editRevision: 5, value: { id: 'g-1', label: 'Icons' } } });
        await repository.renameGroup(ctx, 'g-1', 'Icons', 4);
        expect(mocked.patch).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/palette/groups/g-1', {
            label: 'Icons',
            editRevision: 4,
        });
    });

    it('переводит ошибки сервера в PaletteOperationError', async () => {
        const repository = createHttpPaletteRepository();
        mocked.post.mockRejectedValueOnce(
            Object.assign(new Error('409'), {
                isAxiosError: true,
                response: { status: 409, data: { error: 'Conflict', code: 'TENANT_EDIT_CONFLICT', editRevision: 9 } },
            }),
        );
        await expect(repository.createGroup(ctx, 'Avatars', 1)).rejects.toMatchObject({
            status: 409,
            code: 'TENANT_EDIT_CONFLICT',
            details: { editRevision: 9 },
        });
    });

    it('источник по умолчанию — local', () => {
        expect(paletteSourceFromEnv(undefined)).toBe('local');
        expect(paletteSourceFromEnv('api')).toBe('api');
    });
});

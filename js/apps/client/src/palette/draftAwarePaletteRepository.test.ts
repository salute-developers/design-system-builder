import { describe, expect, it, vi } from 'vitest';

import golden from '../modules/palette/fixtures/palette-golden.json';
import {
    createLocalPaletteRepository,
    PaletteOperationError,
    type PaletteRepository,
    type PaletteTokenRef,
    type PaletteTokenValue,
} from '../modules/palette';
import { withDraftTokens, type DraftAwareDeps } from './draftAwarePaletteRepository';

const ctx = { projectId: 'p', designSystemId: 'd', tenantId: 't' };
const green = { type: 'general' as const, shade: 'green' };
const h190 = { type: 'additional' as const, shade: 'h190' };
const draftToken = { id: 'draft:text.default.accent-new', name: 'text.default.accent-new', displayName: 'New' };

/** Сервер — локальный адаптер на эталоне без токена черновика; тема клиента — эталон и токен черновика. */
const setup = (draftValue: string, drafted: ReadonlySet<string> = new Set(), override?: PaletteTokenValue[]) => {
    let id = 0;
    const server = createLocalPaletteRepository({
        storage: { getItem: () => null, setItem: () => undefined },
        newId: () => `id-${++id}`,
        template: () => golden.template,
        theme: () => ({
            tokens: golden.scenario.tokens as PaletteTokenRef[],
            values: golden.scenario.values as PaletteTokenValue[],
            canEdit: true,
        }),
        applyRewrite: () => undefined,
    });
    const base: PaletteRepository = {
        ...server,
        source: 'api',
        removeRamp: vi.fn(async () => ({ editRevision: 9, value: { reassigned: 2 } })),
    };
    const applyRewrite = vi.fn<DraftAwareDeps['applyRewrite']>();
    const { repository, draftLinks } = withDraftTokens(base, {
        theme: () => ({
            tokens: [...(golden.scenario.tokens as PaletteTokenRef[]), draftToken],
            values: [
                ...(override ?? (golden.scenario.values as PaletteTokenValue[])),
                { tokenId: draftToken.id, mode: 'light', platform: 'web', value: draftValue },
            ],
            canEdit: true,
        }),
        drafted: () => drafted,
        applyRewrite,
    });
    return { base, repository, draftLinks, applyRewrite };
};

const accentOf = async (repository: PaletteRepository) =>
    (await repository.load(ctx)).groups.find((group) => group.systemKey === 'accent')!;

describe('адаптер api с токенами черновика', () => {
    it('дополняет связи сервера связями токенов только из черновика', async () => {
        const { repository, draftLinks } = setup('[general.green.300]');
        const accent = await accentOf(repository);

        const links = await repository.links(ctx, { slot: green, groupId: accent.id });

        expect(links.map((link) => link.tokenId)).toContain(draftToken.id);
        expect(links.find((link) => link.tokenId === draftToken.id)).toMatchObject({ groupId: accent.id, step: 300 });
        expect(draftLinks(ctx, accent.id, green)).toEqual({ added: 1, any: true });
    });

    it('не убирает растяжку без стратегии, если на неё ссылается токен черновика', async () => {
        const { base, repository } = setup('[general.green.300]');
        const accent = await accentOf(repository);

        await expect(repository.removeRamp(ctx, accent.id, green, { editRevision: 0 })).rejects.toMatchObject({
            code: 'PALETTE_RAMP_LINKED',
            status: 409,
        });
        expect(base.removeRamp).not.toHaveBeenCalled();
    });

    it('проверяет ступени замены и для токенов черновика', async () => {
        const { base, repository } = setup('[general.green.50]');
        const accent = await accentOf(repository);

        const error = await repository
            .removeRamp(ctx, accent.id, green, { strategy: 'replace', replacement: h190, editRevision: 0 })
            .catch((value: unknown) => value);

        expect(error).toBeInstanceOf(PaletteOperationError);
        expect(error).toMatchObject({ code: 'PALETTE_STEP_MISSING', details: { steps: [50] } });
        expect(base.removeRamp).not.toHaveBeenCalled();
    });

    it('после удаления на сервере переписывает ссылки группы в черновике', async () => {
        const { repository, applyRewrite } = setup('[general.green.300]');
        const accent = await accentOf(repository);
        const ramp = accent.ramps.find((item) => item.slot.shade === 'green')!;

        const result = await repository.removeRamp(ctx, accent.id, green, { strategy: 'detach', editRevision: 0 });

        expect(result).toEqual({ editRevision: 9, value: { reassigned: 3 } });
        const [context, rewrite, resolveHex] = applyRewrite.mock.calls[0];
        expect(context).toBe(ctx);
        expect(rewrite.from).toEqual(green);
        expect(rewrite.to).toBe('detach');
        expect(rewrite.tokenIds).toEqual(expect.arrayContaining(['t1', draftToken.id]));
        expect(resolveHex(300)).toBe(ramp.steps.find((step) => step.step === 300)!.value);
    });

    it('связи сохранённого токена с записью черновика считаются по черновику', async () => {
        // В черновике ссылки t1 переведены на green.150; сервер по-прежнему видит green.500 и green.400.
        const values = (golden.scenario.values as PaletteTokenValue[]).map((value) =>
            value.tokenId === 't1' ? { ...value, value: '[general.green.150]' } : value,
        );
        const { repository } = setup('#000000', new Set(['t1']), values);
        const accent = await accentOf(repository);

        const links = await repository.links(ctx, { slot: green, groupId: accent.id });

        expect(links.filter((link) => link.tokenId === 't1').map((link) => link.step)).toEqual([150, 150]);
    });

    it('не убирает растяжку без стратегии, если на неё ссылается черновое значение сохранённого токена', async () => {
        const values = (golden.scenario.values as PaletteTokenValue[]).map((value) =>
            value.tokenId === 't1' ? { ...value, value: '[general.green.150]' } : value,
        );
        const { base, repository, draftLinks } = setup('#000000', new Set(['t1']), values);
        const accent = await accentOf(repository);

        // Сохранённый токен уже учтён сервером в linkedCount: к числу не добавляется, но связь есть.
        expect(draftLinks(ctx, accent.id, green)).toEqual({ added: 0, any: true });
        await expect(repository.removeRamp(ctx, accent.id, green, { editRevision: 0 })).rejects.toMatchObject({
            code: 'PALETTE_RAMP_LINKED',
        });
        expect(base.removeRamp).not.toHaveBeenCalled();
    });

    it('ошибка записи черновика после удаления на сервере не отменяет результат', async () => {
        const { repository, applyRewrite } = setup('[general.green.300]');
        const accent = await accentOf(repository);
        applyRewrite.mockImplementation(() => {
            throw new Error('quota');
        });
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const result = await repository.removeRamp(ctx, accent.id, green, { strategy: 'detach', editRevision: 0 });

        expect(result.editRevision).toBe(9);
        expect(error).toHaveBeenCalled();
        error.mockRestore();
    });
});

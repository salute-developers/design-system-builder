import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/designSystemDraft', () => ({
    updateDraftToken: vi.fn(),
    getDraftKey: () => 'ds_draft:test',
    draftTokenNames: () => new Set<string>(),
}));

import { updateDraftToken } from '../utils/designSystemDraft';
import type { DesignSystem, Theme } from '../controllers';
import golden from '../modules/palette/fixtures/palette-golden.json';
import { createLocalPaletteRepository } from '../modules/palette';
import { applyRewriteToDraft, themePaletteInput, type PaletteSession } from './paletteSession';

const token = (name: string, platforms: Record<string, unknown>) => {
    const values = { ...platforms };
    return {
        getName: () => name,
        getDisplayName: () => name.split('.').slice(-1)[0],
        getPlatforms: () => values,
        getValue: (platform: string) => values[platform],
        setValue: vi.fn((platform: string, value: unknown) => {
            values[platform] = value;
        }),
    };
};

const session = (readOnly = false) => {
    const tokens = [
        token('light.text.default.accent', { web: '[general.green.500]', ios: '[general.green.500][0.5]' }),
        token('dark.text.default.accent', { web: '[general.green.400]' }),
        token('light.text.default.primary', { web: '[general.gray.900]' }),
        token('light.unknown.token', { web: '#FFFFFF' }),
    ];
    const current: PaletteSession = {
        context: { projectId: 'p', designSystemId: 'd', tenantId: 't' },
        designSystem: { getName: () => 'ds', getVersion: () => '1.0.0' } as unknown as DesignSystem,
        theme: { getTokens: () => tokens } as unknown as Theme,
        tokens: [
            { id: 't1', name: 'text.default.accent', displayName: 'Accent' },
            { id: 't2', name: 'text.default.primary', displayName: 'Primary' },
        ],
        readOnly,
    };
    return { current, tokens };
};

beforeEach(() => vi.clearAllMocks());

describe('сессия палитры', () => {
    it('themePaletteInput берёт значения темы по id токена, режиму и платформе', () => {
        const { current } = session(true);
        const input = themePaletteInput(current);
        expect(input.canEdit).toBe(false);
        expect(input.values).toEqual([
            { tokenId: 't1', mode: 'light', platform: 'web', value: '[general.green.500]' },
            { tokenId: 't1', mode: 'light', platform: 'ios', value: '[general.green.500][0.5]' },
            { tokenId: 't1', mode: 'dark', platform: 'web', value: '[general.green.400]' },
            { tokenId: 't2', mode: 'light', platform: 'web', value: '[general.gray.900]' },
            // Токен есть только в черновике: палитра видит его связи под временным id.
            { tokenId: 'draft:unknown.token', mode: 'light', platform: 'web', value: '#FFFFFF' },
        ]);
        expect(input.tokens.map((token) => token.id)).toEqual(['t1', 't2', 'draft:unknown.token']);
    });

    it('растяжка, на которую ссылается только токен черновика, связана: удалить её молча нельзя', async () => {
        const { current, tokens } = session();
        tokens.push(token('light.surface.default.draft-fill', { web: '[additional.h130.500]' }));
        const items = new Map<string, string>();
        const applyRewrite = vi.fn((_ctx, rewrite, resolveHex) => applyRewriteToDraft(current, rewrite, resolveHex));
        const repository = createLocalPaletteRepository({
            storage: { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) },
            newId: (() => {
                let id = 0;
                return () => `id-${++id}`;
            })(),
            template: () => golden.template,
            theme: () => themePaletteInput(current),
            applyRewrite,
        });
        const palette = await repository.load(current.context);
        const neutral = palette.groups.find((group) => group.systemKey === 'neutral')!;
        const h130 = { type: 'additional' as const, shade: 'h130' };
        expect(neutral.ramps.find((ramp) => ramp.slot.shade === 'h130')?.linkedCount).toBe(1);
        await expect(repository.removeRamp(current.context, neutral.id, h130, { editRevision: 0 })).rejects.toMatchObject({
            code: 'PALETTE_RAMP_LINKED',
        });
        await repository.removeRamp(current.context, neutral.id, h130, { strategy: 'detach', editRevision: 0 });
        expect(applyRewrite.mock.calls[0][1].tokenIds).toEqual(['draft:surface.default.draft-fill']);
        expect(tokens[4].getValue('web')).toBe(golden.template['additional.h130']['500']);
        await expect(
            repository.assignTokenGroup(current.context, 'draft:surface.default.draft-fill', neutral.id, 1),
        ).rejects.toMatchObject({ status: 400 });
    });

    it('applyRewriteToDraft атомарна: ошибка записи черновика возвращает значения токенов и черновик', () => {
        const { current, tokens } = session();
        localStorage.setItem('ds_draft:test', '{"before":true}');
        vi.mocked(updateDraftToken)
            .mockImplementationOnce(() => localStorage.setItem('ds_draft:test', '{"partial":true}'))
            .mockImplementationOnce(() => {
                throw new Error('QuotaExceededError');
            });
        expect(() =>
            applyRewriteToDraft(
                current,
                { tokenIds: ['t1'], from: { type: 'general', shade: 'green' }, to: 'detach' },
                () => '#00AA00',
            ),
        ).toThrow('QuotaExceededError');
        expect(tokens[0].getValue('web')).toBe('[general.green.500]');
        expect(tokens[0].getValue('ios')).toBe('[general.green.500][0.5]');
        expect(tokens[1].getValue('web')).toBe('[general.green.400]');
        expect(localStorage.getItem('ds_draft:test')).toBe('{"before":true}');
    });

    it('отмена записи, которую возвращает applyRewriteToDraft, восстанавливает токены и черновик', () => {
        const { current, tokens } = session();
        localStorage.removeItem('ds_draft:test');
        vi.mocked(updateDraftToken).mockImplementation(() => localStorage.setItem('ds_draft:test', '{}'));
        const undo = applyRewriteToDraft(
            current,
            { tokenIds: ['t1'], from: { type: 'general', shade: 'green' }, to: 'detach' },
            () => '#00AA00',
        );
        expect(tokens[0].getValue('web')).toBe('#00AA00');
        undo();
        expect(tokens[0].getValue('web')).toBe('[general.green.500]');
        expect(localStorage.getItem('ds_draft:test')).toBeNull();
        vi.mocked(updateDraftToken).mockReset();
    });

    it('applyRewriteToDraft переводит ссылки затронутых токенов в HEX и пишет их в черновик', () => {
        const { current, tokens } = session();
        applyRewriteToDraft(
            current,
            { tokenIds: ['t1'], from: { type: 'general', shade: 'green' }, to: 'detach' },
            (step) => (step === 500 ? '#00AA00' : '#008800'),
        );
        expect(tokens[0].getValue('web')).toBe('#00AA00');
        expect(tokens[0].getValue('ios')).toBe('#00AA0080');
        expect(tokens[1].getValue('web')).toBe('#008800');
        expect(tokens[2].setValue).not.toHaveBeenCalled();
        expect(vi.mocked(updateDraftToken).mock.calls.map(([name, version, item]) => [name, version, item?.getName()])).toEqual([
            ['ds', '1.0.0', 'light.text.default.accent'],
            ['ds', '1.0.0', 'dark.text.default.accent'],
        ]);
    });

    it('applyRewriteToDraft с заменой меняет растяжку ссылки и сохраняет ступень и прозрачность', () => {
        const { current, tokens } = session();
        applyRewriteToDraft(
            current,
            { tokenIds: ['t1'], from: { type: 'general', shade: 'green' }, to: { type: 'additional', shade: 'h190' } },
            () => undefined,
        );
        expect(tokens[0].getValue('web')).toBe('[additional.h190.500]');
        expect(tokens[0].getValue('ios')).toBe('[additional.h190.500][0.5]');
    });
});

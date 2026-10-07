import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/designSystemDraft', () => ({ updateDraftToken: vi.fn() }));

import { updateDraftToken } from '../utils/designSystemDraft';
import type { DesignSystem, Theme } from '../controllers';
import { applyRewriteToDraft, themePaletteInput, type PaletteSession } from './paletteSession';

const token = (name: string, platforms: Record<string, unknown>) => {
    const values = { ...platforms };
    return {
        getName: () => name,
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
        ]);
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

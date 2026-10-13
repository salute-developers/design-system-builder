import { describe, expect, it } from 'vitest';

import { AndroidColor, ColorToken, IOSColor, WebColor } from '../../../controllers';
import { familyCreateMembers, familyUpdate } from './members';
import { legacyDraftFamilies } from './legacyDraft';

const token = (name: string, value: string) =>
    new ColorToken(
        { name, tags: name.split('.'), displayName: name, enabled: true },
        { web: new WebColor(value), ios: new IOSColor(value), android: new AndroidColor(value) },
    );

describe('члены семейства для создания из темы', () => {
    it('берёт значения всех платформ определений с обоими режимами', () => {
        const tokens = [
            token('light.text.default.accent', '#111'),
            token('dark.text.default.accent', '#222'),
            token('light.text.on-dark.accent', '#333'),
        ];
        const members = familyCreateMembers({ getTokens: () => tokens } as never, {
            type: 'color',
            group: 'text',
            name: 'accent',
        });
        expect(members.map((member) => member.name)).toEqual(['text.default.accent']);
        expect(members[0].values).toHaveLength(6);
        expect(members[0].values.find((item) => item.mode === 'dark' && item.platform === 'android')?.value).toEqual([
            '#222',
        ]);
    });
});

describe('тело операции изменения значений', () => {
    it('включает все определения семейства с обоими режимами и тремя платформами', () => {
        const tokens = [
            token('light.text.default.accent', '#111'),
            token('dark.text.default.accent', '[general.blue.500][0.5]'),
            token('light.text.default.accent-hover', '#222'),
            token('dark.text.default.accent-hover', '#333'),
            token('light.text.on-dark.accent', '#444'),
            token('light.text.default.primary', '#555'),
            token('dark.text.default.primary', '#666'),
        ];
        const theme = { getTokens: () => tokens } as never;
        const definitions = new Map([
            ['text.default.accent', { id: 'id-accent', type: 'color' }],
            ['text.default.accent-hover', { id: 'id-hover', type: 'color' }],
            ['text.on-dark.accent', { id: 'id-on-dark', type: 'color' }],
        ]);
        const update = familyUpdate(theme, { type: 'color', group: 'text', name: 'accent' }, definitions);
        expect(update?.tokenId).toBe('id-accent');
        expect(update?.update.members.map((member) => member.tokenId)).toEqual(['id-accent', 'id-hover']);
        const accent = update!.update.members[0].values;
        expect(accent).toHaveLength(6);
        expect(accent.find((item) => item.mode === 'dark' && item.platform === 'ios')?.value).toEqual([
            '[general.blue.500][0.5]',
        ]);
    });

    it('возвращает null без сохранённых определений', () => {
        const theme = {
            getTokens: () => [token('light.text.default.x', '#1'), token('dark.text.default.x', '#2')],
        } as never;
        expect(familyUpdate(theme, { type: 'color', group: 'text', name: 'x' }, new Map())).toBeNull();
    });
});

describe('семейства прежнего черновика', () => {
    it('собирает уникальные семейства цветов и градиентов', () => {
        expect(
            legacyDraftFamilies([
                { name: 'dark.text.default.accent', type: 'color' },
                { name: 'light.text.on-dark.accent-hover', type: 'color' },
                { name: 'dark.surface.default.accent-gradient', type: 'gradient' },
                { name: 'screen-s.body.m', type: 'typography' },
            ]),
        ).toEqual([
            { type: 'color', group: 'text', name: 'accent' },
            { type: 'gradient', group: 'surface', name: 'accent-gradient' },
        ]);
    });
});

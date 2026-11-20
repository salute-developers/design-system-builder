import { describe, expect, it } from 'vitest';

import type { Theme } from '../../../../controllers';

import { getColorTokenOptions, getShapeTokenOptions, getTypographyTokenOptions } from './inspectorTokens';

const token = (name: string, mode = 'dark') => ({
    getName: () => `${mode}.${name}`,
    getEnabled: () => true,
    getTags: () => [mode],
    getValue: () => '#ffffff',
});

const theme = (names: string[]) =>
    ({
        getTokens: (type: string) => (type === 'color' ? names.map((name) => token(name)) : []),
    }) as unknown as Theme;

describe('getColorTokenOptions', () => {
    it('offers the derived hover, active and brightness tokens next to the base ones', () => {
        const names = [
            'surface.default.solid-default',
            'surface.default.solid-default-hover',
            'surface.default.solid-default-active',
            'surface.default.solid-default-brightness',
            'text.default.inactive',
        ];

        expect(getColorTokenOptions(theme(names), 'dark').map((option) => option.value)).toEqual(names);
    });
});

describe('token hints', () => {
    const tokens = (type: string, items: Array<{ name: string; tag: string; value: unknown }>) =>
        ({
            getTokens: (requested: string) =>
                requested === type
                    ? items.map(({ name, tag, value }) => ({
                          getName: () => name,
                          getEnabled: () => true,
                          getTags: () => [tag],
                          getValue: () => value,
                      }))
                    : [],
        }) as unknown as Theme;

    it('shows a shape size in px: px as is, rem converted', () => {
        const options = getShapeTokenOptions(
            tokens('shape', [
                { name: 'round.m', tag: 'round', value: '0.75rem' },
                { name: 'round.l', tag: 'round', value: '16px' },
            ]),
        );

        expect(options.map((option) => option.hint)).toEqual(['12 px', '16 px']);
    });

    it('shows the font size of a typography style in px', () => {
        const options = getTypographyTokenOptions(
            tokens('typography', [{ name: 'screen-s.body.m.normal', tag: 'screen-s', value: { fontSize: '1rem' } }]),
        );

        expect(options).toEqual([{ value: 'body.m.normal', label: 'body.m.normal', hint: '16' }]);
    });
});

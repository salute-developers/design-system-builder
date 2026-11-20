import { describe, expect, it } from 'vitest';

import { applyPreviewView, viewTokenId } from './viewContainer';

describe('viewTokenId', () => {
    it('maps default and inverse colours like plasma ViewContainer', () => {
        expect(viewTokenId('dark.text.default.primary', 'onDark')).toBe('dark.text.on-dark.primary');
        expect(viewTokenId('dark.text.inverse.primary', 'onDark')).toBe('dark.text.on-light.primary');
        expect(viewTokenId('light.text.default.primary', 'onLight')).toBe('light.text.on-light.primary');
        expect(viewTokenId('light.text.inverse.primary', 'onLight')).toBe('light.text.on-dark.primary');
        expect(viewTokenId('dark.background.default.primary', 'onDark')).toBe('dark.background.dark.primary');
        expect(viewTokenId('dark.background.default.primary', 'onLight')).toBe('dark.background.light.primary');
    });

    it('keeps the token in default view and for other subcategories', () => {
        expect(viewTokenId('dark.text.default.primary', 'default')).toBe('dark.text.default.primary');
        expect(viewTokenId('dark.text.on-dark.primary', 'onLight')).toBe('dark.text.on-dark.primary');
    });
});

describe('applyPreviewView', () => {
    const token = (id: string, value: string, type = 'color') => ({ id, type, values: { web: value } });

    it('takes values of the paired tokens and keeps tokens without a pair', () => {
        const tokens = [
            token('dark.text.default.primary', '#fff'),
            token('dark.text.on-light.primary', '#000'),
            token('dark.text.default.secondary', '#eee'),
            token('dark.text.on-dark.primary', '#ddd'),
            token('screen-s.body.m', 'body', 'typography'),
        ];

        const result = applyPreviewView(tokens, 'onLight');

        expect(result.map((item) => [item.id, item.values.web])).toEqual([
            ['dark.text.default.primary', '#000'],
            ['dark.text.on-light.primary', '#000'],
            ['dark.text.default.secondary', '#eee'],
            ['dark.text.on-dark.primary', '#ddd'],
            ['screen-s.body.m', 'body'],
        ]);
        expect(applyPreviewView(tokens, 'default')).toBe(tokens);
    });
});

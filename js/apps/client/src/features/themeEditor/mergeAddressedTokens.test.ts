import { expect, it } from 'vitest';
import type { ThemeEditorSnapshot, ThemeEditorTokenSnapshot } from '../../api/editorContracts';
import { mergeAddressedTokens } from './mergeAddressedTokens';

it('смена color на gradient сохраняет shape с именем, совпадающим с модальным именем цвета', () => {
    const names = ['color', 'gradient', 'shape', 'shadow', 'spacing', 'typography', 'fontFamily'];
    const previous = {
        tokenDefinitionsByName: {
            'text.default.primary': { id: 'color-id', type: 'color', name: 'text.default.primary' },
            'light.text.default.primary': { id: 'shape-id', type: 'shape', name: 'light.text.default.primary' },
        },
        tokenValueRevisionsByKey: { 'color-id:web:light': 2, 'shape-id:web:': 7 },
        tokenValueEntityIdsByKey: { 'color-id:web:light': 'color-value', 'shape-id:web:': 'shape-value' },
        incompleteTokenIds: [],
        themeData: {
            meta: { tokens: [
                { type: 'color', name: 'light.text.default.primary' },
                { type: 'shape', name: 'light.text.default.primary' },
            ] },
            variations: Object.fromEntries(names.map((type) => [type, { web: {}, ios: {}, android: {} }])),
        },
    } as unknown as ThemeEditorSnapshot;
    previous.themeData.variations.color.web['light.text.default.primary'] = '#123456';
    previous.themeData.variations.shape.web['light.text.default.primary'] = 12;
    const next = structuredClone(previous) as ThemeEditorTokenSnapshot;
    next.tokenDefinitionsByName = {
        'text.default.primary': { ...previous.tokenDefinitionsByName!['text.default.primary'], type: 'gradient' },
    };
    next.tokenValueRevisionsByKey = { 'color-id:web:light': 0 };
    next.tokenValueEntityIdsByKey = { 'color-id:web:light': 'color-value' };
    next.themeData.meta.tokens = [{ ...previous.themeData.meta.tokens[0], type: 'gradient' }];
    next.themeData.variations.color.web = {};
    next.themeData.variations.shape.web = {};
    next.themeData.variations.gradient.web['light.text.default.primary'] = ['#123456', '#abcdef'];
    const merged = mergeAddressedTokens(previous, next, new Set(['color-id']));
    expect(merged.themeData.variations.color.web).toEqual({});
    expect(merged.themeData.variations.gradient.web).toEqual(next.themeData.variations.gradient.web);
    expect(merged.themeData.variations.shape.web).toEqual({ 'light.text.default.primary': 12 });
    expect(merged.themeData.meta.tokens).toContainEqual(previous.themeData.meta.tokens[1]);
    expect(merged.tokenValueRevisionsByKey['shape-id:web:']).toBe(7);
    expect(merged.tokenValueEntityIdsByKey?.['shape-id:web:']).toBe('shape-value');
});

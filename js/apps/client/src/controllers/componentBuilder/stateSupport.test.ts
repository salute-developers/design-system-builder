import { describe, expect, it } from 'vitest';

import { allowsCombinations, bindableStates, isStateSetAllowed } from './stateSupport';

const color = { name: 'background', type: 'color' as const };

describe('bindableStates', () => {
    it('offers exactly the states of the support, primary states first', () => {
        const api = { ...color, stateSupport: { states: ['dragging-over', 'hovered', 'focused'], combinations: true } };

        expect(bindableStates(api, false)).toEqual(['focused', 'hovered', 'dragging-over']);
    });

    it('offers states to a property of any type', () => {
        const api = {
            name: 'paddingStart',
            type: 'dimension' as const,
            stateSupport: { states: ['dragging-over'], combinations: true },
        };

        expect(bindableStates(api, false)).toEqual(['dragging-over']);
    });

    it('offers nothing to an empty support and to a combination row', () => {
        expect(bindableStates({ ...color, stateSupport: { states: [], combinations: false } }, false)).toEqual([]);
        expect(bindableStates({ ...color, stateSupport: { states: ['hovered'], combinations: true } }, true)).toEqual(
            [],
        );
    });

    it('keeps the previous rule without a support', () => {
        expect(bindableStates({ ...color, stateSupport: null }, false)).toEqual(['focused', 'pressed', 'hovered']);
        expect(bindableStates({ ...color, name: 'focusColor' }, false)).toEqual([]);
        expect(bindableStates({ name: 'padding', type: 'dimension' }, false)).toEqual([]);
        expect(allowsCombinations({ ...color, stateSupport: null })).toBe(true);
    });
});

describe('isStateSetAllowed', () => {
    const api = { ...color, stateSupport: { states: ['pressed', 'hovered'], combinations: false } };

    it('allows a listed single state and rejects others and combinations', () => {
        expect(isStateSetAllowed(api, ['hovered'])).toBe(true);
        expect(isStateSetAllowed(api, ['disabled'])).toBe(false);
        expect(isStateSetAllowed(api, ['pressed', 'hovered'])).toBe(false);
    });

    it('allows everything without a support', () => {
        expect(isStateSetAllowed({ ...color, stateSupport: null }, ['disabled', 'pressed'])).toBe(true);
    });
});

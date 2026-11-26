import { describe, expect, it } from 'vitest';

import { resolveStateId, stateSupportOf } from './componentStates';

const states = [
    { id: 'common-checked', name: 'checked', componentId: null },
    { id: 'checkbox-checked', name: 'checked', componentId: 'checkbox' },
    { id: 'radio-collapsed', name: 'collapsed', componentId: 'radio' },
    { id: 'checkbox-collapsed', name: 'collapsed', componentId: 'checkbox' },
];

describe('resolveStateId', () => {
    it('takes the common state first, then the own state of the component', () => {
        expect(resolveStateId('checked', 'checkbox', states)).toBe('common-checked');
        expect(resolveStateId('collapsed', 'checkbox', states)).toBe('checkbox-collapsed');
    });

    it('never takes a state of another component', () => {
        expect(resolveStateId('collapsed', 'switch', states)).toBeUndefined();
    });
});

describe('stateSupportOf', () => {
    const property = { id: 'p', name: 'fill', type: 'color', description: null };

    it('turns ids into names of the bundle states', () => {
        const support = { stateIds: ['checkbox-collapsed', 'common-checked'], combinations: false };

        expect(stateSupportOf({ ...property, stateSupport: support }, states)).toEqual({
            states: ['collapsed', 'checked'],
            combinations: false,
        });
    });

    it('keeps an undeclared support and an older server apart', () => {
        expect(stateSupportOf({ ...property, stateSupport: null }, states)).toBeNull();
        expect(stateSupportOf(property, states)).toBeUndefined();
        expect(stateSupportOf({ ...property, stateSupport: null }, undefined)).toBeUndefined();
    });
});

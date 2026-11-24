import { describe, expect, it } from 'vitest';

import { compareStates } from './InspectorPropertyRow';

describe('compareStates', () => {
    it('orders single states by the menu, then combinations, whatever the order they were added in', () => {
        const added = [['focused'], ['pressed', 'hovered'], ['pressed'], ['hovered'], ['focused', 'hovered']];

        expect([...added].sort(compareStates).map((state) => state.join('+'))).toEqual([
            'focused',
            'pressed',
            'hovered',
            'focused+hovered',
            'pressed+hovered',
        ]);
        expect([...added].reverse().sort(compareStates)).toEqual([...added].sort(compareStates));
    });
});

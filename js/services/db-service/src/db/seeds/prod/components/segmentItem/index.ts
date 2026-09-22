import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'SegmentItem',
    description: 'Компонент сегмента.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'clear', size: 'xs' }, values, invariants },
    ],
};

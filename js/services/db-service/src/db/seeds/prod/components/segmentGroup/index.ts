import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'SegmentGroup',
    description: 'Компонент группы сегментов.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'clear', size: 'xs', orientation: 'horizontal' }, values, invariants },
    ],
};

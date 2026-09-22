import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Slider',
    description: 'Слайдер.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 'm', pointerSize: 'small', view: 'default' }, values, invariants },
    ],
};

import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'List',
    description: 'Список.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 's', view: 'default' }, values, invariants },
    ],
};

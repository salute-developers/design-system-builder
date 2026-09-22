import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Chip',
    description: 'Чип.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 'm', view: 'default', shape: 'Rounded' }, values, invariants },
    ],
};

import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Switch',
    description: 'Переключатель.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 'm', toggleSize: 'l', view: 'default' }, values, invariants },
    ],
};

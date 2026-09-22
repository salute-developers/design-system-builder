import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Sheet',
    description: 'Открывает окно-шторку поверх основного экрана.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', handlePlacement: 'outer' }, values },
    ],
};

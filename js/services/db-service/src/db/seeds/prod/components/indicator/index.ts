import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Indicator',
    description: 'Индикатор.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 's', view: 'Default' }, values },
    ],
};

import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Divider',
    description: 'Разделитель.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', orientation: 'horizontal', size: 'm' }, values },
    ],
};

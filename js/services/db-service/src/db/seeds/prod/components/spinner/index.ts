import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Spinner',
    description: 'Индикатор загрузки.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 'M', view: 'accent' }, values },
    ],
};

import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Badge',
    description: 'Бейдж.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'Default', size: 'M', shape: 'Rounded' }, values },
    ],
};

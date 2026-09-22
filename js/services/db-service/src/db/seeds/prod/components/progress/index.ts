import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Progress',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', size: 'm', progressSize: '4' }, values },
    ],
};

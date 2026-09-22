import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Body',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 'm' }, values },
    ],
};

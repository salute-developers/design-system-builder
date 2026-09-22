import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'AvatarGroup',
    properties,
    variations,
    appearances: [
        { name: 'default', values },
    ],
};

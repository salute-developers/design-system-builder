import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Toast',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', size: 'm', closeIconType: 'default', shape: 'rounded' }, values },
    ],
};

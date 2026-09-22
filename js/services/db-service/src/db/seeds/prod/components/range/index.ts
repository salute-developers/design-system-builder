import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Range',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', size: 'l', hintView: 'default', hintSize: 'm' }, values, invariants },
    ],
};

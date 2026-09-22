import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'TextArea',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', size: 'm', hintView: 'default', hintSize: 'm' }, values, invariants },
    ],
};

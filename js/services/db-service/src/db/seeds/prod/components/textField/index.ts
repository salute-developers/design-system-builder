import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'TextField',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', size: 'm', labelPlacement: 'outer', chipView: 'default', hintView: 'default' }, values, invariants },
    ],
};

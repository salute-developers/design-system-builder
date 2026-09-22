import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'IconButton',
    description: 'Кнопка с иконкой.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', size: 'm', shape: 'rounded' }, values, invariants },
    ],
};

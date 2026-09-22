import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'TextFieldGroup',
    description: 'Группа TextField.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 'm', orientation: 'horizontal', gap: 'dense', shape: 'default', stretching: 'auto' }, values },
    ],
};

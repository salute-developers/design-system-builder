import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values, invariants } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Radiobox',
    description: 'Переключатель (радиокнопка).',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'accent', size: 'm' }, values, invariants },
    ],
};

import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Pagination',
    description: 'Пагинация',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'clear', viewCurrentPage: 'secondary', size: 'xs', type: 'default' }, values },
    ],
};

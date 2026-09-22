import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import * as horizontal from './values.horizontal';
import * as vertical from './values.vertical';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'IconTabItem',
    properties,
    variations,
    appearances: [
        { name: 'horizontal', defaults: { view: 'divider', size: 'xs' }, ...horizontal },
        { name: 'vertical', defaults: { view: 'divider', size: 'xs' }, ...vertical },
    ],
};

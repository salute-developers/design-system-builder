import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Drawer',
    description: 'Компонент Drawer.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { view: 'default', size: 'm', borderRadius: 'none' }, values },
    ],
};

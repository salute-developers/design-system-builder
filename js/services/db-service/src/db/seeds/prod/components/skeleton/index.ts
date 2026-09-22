import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Skeleton',
    description: 'Компонент загрузки.',
    properties,
    variations,
    appearances: [
        { name: 'default', defaults: { size: 'bodyM', view: 'default' }, values },
    ],
};

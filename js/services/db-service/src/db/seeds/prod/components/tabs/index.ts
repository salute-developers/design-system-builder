import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import * as horizontal from './values.horizontal';
import * as vertical from './values.vertical';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Tabs',
    description: 'Контейнер вкладок, основной компонент для пользовательской сборки вкладок.',
    properties,
    variations,
    appearances: [
        { name: 'horizontal', defaults: { view: 'filled', size: 'l' }, ...horizontal },
        { name: 'vertical', variations: ['view', 'size', 'stretch'], defaults: { view: 'divider', size: 'l' }, ...vertical },
    ],
};

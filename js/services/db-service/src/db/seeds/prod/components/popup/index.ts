import type { ComponentSeed } from '../../component-seed';
import { properties } from './properties';
import { values } from './values';
import { variations } from './variations';

export const seed: ComponentSeed = {
    name: 'Popup',
    description: 'Базовый компонент Popup.',
    properties,
    variations,
    appearances: [
        { name: 'default', values },
    ],
};

import {
    api as apiIconButton,
    variations as variationsIconButton,
    config as configIconButton,
    staticAPI as staticAPIIconButton,
} from './IconButton';
import { api as apiLink, variations as variationsLink, config as configLink, staticAPI as staticAPILink } from './Link';
import {
    api as apiButton,
    variations as variationsButton,
    config as configButton,
    staticAPI as staticAPIButton,
} from './Button';

// TODO: Забирать из бд по api
export const componentsData = [
    {
        name: 'IconButton',
        description: 'Кнопка с иконкой.',
        sources: {
            api: apiIconButton,
            config: configIconButton,
            staticAPI: staticAPIIconButton,
            variations: variationsIconButton,
        },
    },
    {
        name: 'Button',
        description: 'Кнопка.',
        sources: {
            api: apiButton,
            config: configButton,
            staticAPI: staticAPIButton,
            variations: variationsButton,
        },
    },
    {
        name: 'Link',
        description: 'Ссылка.',
        sources: {
            api: apiLink,
            config: configLink,
            staticAPI: staticAPILink,
            variations: variationsLink,
        },
    },
];

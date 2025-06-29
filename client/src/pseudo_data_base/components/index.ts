import { api as apiIconButton, variations as variationsIconButton, configs as configsIconButton } from './IconButton';
import { api as apiLink, variations as variationsLink, configs as configsLink } from './Link';
import { api as apiButton, variations as variationsButton, configs as configsButton } from './Button';
import { api as apiCheckbox, variations as variationsCheckbox, configs as configsCheckbox } from './Checkbox';
import { api as apiRadiobox, variations as variationsRadiobox, configs as configsRadiobox } from './Radiobox';

// TODO: Забирать из бд по api
export const componentsData = [
    {
        name: 'IconButton',
        description: 'Кнопка с иконкой.',
        sources: {
            api: apiIconButton,
            configs: configsIconButton,
            variations: variationsIconButton,
        },
    },
    {
        name: 'Button',
        description: 'Кнопка.',
        sources: {
            api: apiButton,
            configs: configsButton,
            variations: variationsButton,
        },
    },
    {
        name: 'Link',
        description: 'Ссылка.',
        sources: {
            api: apiLink,
            configs: configsLink,
            variations: variationsLink,
        },
    },
    {
        name: 'Checkbox',
        description: 'Флажок или чекбокс, который позволяет управлять двумя состояниями.',
        sources: {
            api: apiCheckbox,
            configs: configsCheckbox,
            variations: variationsCheckbox,
        },
    },
    {
        name: 'Radiobox',
        description: 'Переключатель, или радиокнопка.',
        sources: {
            api: apiRadiobox,
            configs: configsRadiobox,
            variations: variationsRadiobox,
        },
    },
];

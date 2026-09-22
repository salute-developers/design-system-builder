import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'xl', description: 'xl' },
            { name: 'l', description: 'l' },
            { name: 'm', description: 'm' },
            { name: 's', description: 's' },
            { name: 'xs', description: 'xs' },
        ],
    },
    {
        name: 'hintView',
        description: 'Вид подсказки',
        styles: [
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'hintSize',
        description: 'Размер подсказки',
        styles: [
            { name: 'm', description: 'm' },
            { name: 's', description: 's' },
        ],
    },
];

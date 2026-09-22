import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'secondary', description: 'secondary' },
            { name: 'accent', description: 'accent' },
            { name: 'positive', description: 'positive' },
            { name: 'warning', description: 'warning' },
            { name: 'negative', description: 'negative' },
            { name: 'info', description: 'info' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'xxl', description: 'xxl' },
            { name: 'xl', description: 'xl' },
            { name: 'l', description: 'l' },
            { name: 'm', description: 'm' },
            { name: 's', description: 's' },
            { name: 'xs', description: 'xs' },
            { name: 'xxs', description: 'xxs' },
        ],
    },
];

import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'secondary', description: 'secondary' },
            { name: 'accent', description: 'accent' },
            { name: 'accentGradient', description: 'accentGradient' },
            { name: 'info', description: 'info' },
            { name: 'positive', description: 'positive' },
            { name: 'warning', description: 'warning' },
            { name: 'negative', description: 'negative' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'l', description: 'l' },
            { name: 'm', description: 'm' },
            { name: 's', description: 's' },
        ],
    },
    {
        name: 'progressSize',
        description: 'progressSize',
        styles: [
            { name: '2', description: '2' },
            { name: '4', description: '4' },
            { name: '6', description: '6' },
            { name: '8', description: '8' },
        ],
    },
];

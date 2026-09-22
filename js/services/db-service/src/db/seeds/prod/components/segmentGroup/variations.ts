import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'clear', description: 'clear' },
            { name: 'filled', description: 'filled' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'xs', description: 'xs' },
            { name: 's', description: 's' },
            { name: 'm', description: 'm' },
            { name: 'l', description: 'l' },
            { name: 'xl', description: 'xl' },
        ],
    },
    {
        name: 'pilled',
        description: 'pilled',
        styles: [
            { name: 'true', description: 'true' },
        ],
    },
    {
        name: 'stretch',
        description: 'stretch',
        styles: [
            { name: 'true', description: 'true' },
        ],
    },
    {
        name: 'filledBackground',
        description: 'filledBackground',
        styles: [
            { name: 'true', description: 'true' },
        ],
    },
    {
        name: 'orientation',
        description: 'Ориентация',
        styles: [
            { name: 'horizontal', description: 'horizontal' },
            { name: 'vertical', description: 'vertical' },
        ],
    },
];

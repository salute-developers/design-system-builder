import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'accent', description: 'accent' },
            { name: 'secondary', description: 'secondary' },
            { name: 'clear', description: 'clear' },
            { name: 'success', description: 'success' },
            { name: 'warning', description: 'warning' },
            { name: 'critical', description: 'critical' },
            { name: 'dark', description: 'dark' },
            { name: 'black', description: 'black' },
            { name: 'white', description: 'white' },
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
            { name: 'xxs', description: 'xxs' },
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
    {
        name: 'gap',
        description: 'gap',
        styles: [
            { name: 'none', description: 'none' },
            { name: 'dense', description: 'dense' },
            { name: 'wide', description: 'wide' },
        ],
    },
    {
        name: 'shape',
        description: 'Форма',
        styles: [
            { name: 'segmented', description: 'segmented' },
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'stretching',
        description: 'Растяжение',
        styles: [
            { name: 'auto', description: 'auto' },
            { name: 'filled', description: 'filled' },
        ],
    },
];
